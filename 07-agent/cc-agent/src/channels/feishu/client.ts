import { createReadStream } from "node:fs";
import { extname } from "node:path";
import * as lark from "@larksuiteoapi/node-sdk";
import type { FeishuConfig } from "./config.js";
import { buildAnswerCard, extractTextContent, type FeishuReceivedMessage, type FeishuSendTarget } from "./message.js";

export type FeishuMessageReceipt = {
  getReactionId?: string;
};

export class FeishuClient {
  private readonly client?: lark.Client;
  private readonly dispatcher?: lark.EventDispatcher;
  private readonly dedup = new MessageDedup();
  private wsClient?: lark.WSClient;

  constructor(private readonly config: FeishuConfig) {
    if (!config.enabled) return;
    if (!config.appId) throw new Error("Missing FEISHU_APP_ID");
    if (!config.appSecret) throw new Error("Missing FEISHU_APP_SECRET");

    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: lark.Domain.Feishu
    });

    this.dispatcher = new lark.EventDispatcher({
      verificationToken: config.verificationToken,
      encryptKey: config.encryptKey
    });
  }

  resolveChallenge(input: unknown): string | undefined {
    if (!input || typeof input !== "object") return undefined;
    const challenge = (input as { challenge?: unknown }).challenge;
    return typeof challenge === "string" ? challenge : undefined;
  }

  async receive(input: unknown): Promise<FeishuReceivedMessage | null> {
    if (!this.dispatcher) return null;

    let received: FeishuReceivedMessage | null = null;

    const dispatcher = this.dispatcher.register({
      "im.message.receive_v1": async (data: FeishuEventData) => {
        received = normalizeFeishuEvent(data);
      }
    });

    await dispatcher.invoke(input, { needCheck: Boolean(this.config.verificationToken) });
    if (received && this.dedup.isDuplicate(dedupKey(received))) return null;
    return received;
  }

  async startWebSocket(onMessage: (message: FeishuReceivedMessage, receipt: FeishuMessageReceipt) => Promise<void>): Promise<void> {
    if (!this.config.enabled) return;
    if (!this.client) throw new Error("Feishu client is disabled");
    if (this.wsClient) return;

    const dispatcher = new lark.EventDispatcher({
      verificationToken: this.config.verificationToken,
      encryptKey: this.config.encryptKey
    }).register({
      "im.message.receive_v1": async (data: FeishuEventData) => {
        const message = normalizeFeishuEvent(data);
        if (!message) return;
        if (this.dedup.isDuplicate(dedupKey(message))) return;
        logReceivedMessage(message);
        const getReactionId = await this.addReaction(message.messageId, "Get");
        await onMessage(message, { getReactionId });
      },
      "im.message.reaction.created_v1": async () => {},
      "im.message.message_read_v1": async () => {}
    });

    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
      autoReconnect: true,
      source: "cc-agent",
      onReady: () => console.log(`feishu websocket ready: appId=${this.config.appId}`),
      onReconnecting: () => console.warn("feishu websocket reconnecting"),
      onReconnected: () => console.log("feishu websocket reconnected"),
      onError: (error) => console.error(`feishu websocket error: ${error.message}`)
    });

    await this.wsClient.start({ eventDispatcher: dispatcher });
  }

  stopWebSocket(): void {
    this.wsClient?.close();
    this.wsClient = undefined;
  }

  getWebSocketStatus(): string {
    return this.wsClient?.getConnectionStatus().state ?? "idle";
  }

  async sendText(target: FeishuSendTarget, text: string): Promise<void> {
    await this.sendCard(target, buildAnswerCard(text));
  }

  async sendImage(target: FeishuSendTarget, filePath: string): Promise<void> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    const result = await this.client.im.v1.image.create({
      data: {
        image_type: "message",
        image: createReadStream(filePath)
      }
    });
    const imageKey = result?.image_key;
    if (!imageKey) throw new Error("Feishu image_key missing from upload response");

    await this.sendMessageContent(target, "image", { image_key: imageKey });
  }

  async sendFile(target: FeishuSendTarget, filePath: string, fileName: string): Promise<void> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    const result = await this.client.im.v1.file.create({
      data: {
        file_type: inferFeishuFileType(fileName),
        file_name: fileName,
        file: createReadStream(filePath)
      }
    });
    const fileKey = result?.file_key;
    if (!fileKey) throw new Error("Feishu file_key missing from upload response");

    await this.sendMessageContent(target, "file", { file_key: fileKey });
  }

  async sendCard(target: FeishuSendTarget, card: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    if (target.replyTo) {
      const result = await this.client.im.message.reply({
        path: {
          message_id: target.replyTo
        },
        data: {
          content: JSON.stringify(card),
          msg_type: "interactive",
          reply_in_thread: target.replyInThread
        }
      });
      return getMessageId(result);
    }

    const result = await this.client.im.message.create({
      params: {
        receive_id_type: target.receiveIdType
      },
      data: {
        receive_id: target.receiveId,
        content: JSON.stringify(card),
        msg_type: "interactive"
      }
    });
    return getMessageId(result);
  }

  async createCardInstance(card: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    const result = await this.client.cardkit.v1.card.create({
      data: {
        type: "card_json",
        data: JSON.stringify(card)
      }
    });
    const cardId = result.data?.card_id;
    if (!cardId) throw new Error("Feishu card_id missing from create response");
    return cardId;
  }

  async sendCardReference(target: FeishuSendTarget, cardId: string): Promise<string> {
    return this.sendInteractiveContent(target, {
      type: "card",
      data: {
        card_id: cardId
      }
    });
  }

  async updateCardInstance(cardId: string, card: Record<string, unknown>, sequence: number): Promise<void> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    await this.client.cardkit.v1.card.update({
      path: {
        card_id: cardId
      },
      data: {
        card: {
          type: "card_json",
          data: JSON.stringify(card)
        },
        sequence,
        uuid: `card_${cardId}_${sequence}`
      }
    });
  }

  async updateCardElementContent(cardId: string, elementId: string, content: string, sequence: number): Promise<void> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    await this.client.cardkit.v1.cardElement.content({
      path: {
        card_id: cardId,
        element_id: elementId
      },
      data: {
        content,
        sequence,
        uuid: `element_${cardId}_${sequence}`
      }
    });
  }

  async finishStreamingCard(cardId: string, summary: string, sequence: number): Promise<void> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    await this.client.cardkit.v1.card.settings({
      path: {
        card_id: cardId
      },
      data: {
        settings: JSON.stringify({
          config: {
            streaming_mode: false,
            summary: {
              content: summary
            }
          }
        }),
        sequence,
        uuid: `settings_${cardId}_${sequence}`
      }
    });
  }

  async addReaction(messageId: string | undefined, emojiType: string): Promise<string | undefined> {
    if (!messageId || !this.client) return undefined;

    try {
      const result = await this.client.im.v1.messageReaction.create({
        path: {
          message_id: messageId
        },
        data: {
          reaction_type: {
            emoji_type: emojiType
          }
        }
      });
      return result.data?.reaction_id;
    } catch (error) {
      console.warn(`feishu add reaction failed: message=${messageId} emoji=${emojiType} error=${getErrorMessage(error)}`);
      return undefined;
    }
  }

  async deleteReaction(messageId: string | undefined, reactionId: string | undefined): Promise<void> {
    if (!messageId || !reactionId || !this.client) return;

    try {
      await this.client.im.v1.messageReaction.delete({
        path: {
          message_id: messageId,
          reaction_id: reactionId
        }
      });
    } catch (error) {
      console.warn(`feishu delete reaction failed: message=${messageId} reaction=${reactionId} error=${getErrorMessage(error)}`);
    }
  }

  private async sendInteractiveContent(target: FeishuSendTarget, content: Record<string, unknown>): Promise<string> {
    return this.sendMessageContent(target, "interactive", content);
  }

  private async sendMessageContent(target: FeishuSendTarget, msgType: string, content: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      throw new Error("Feishu client is disabled");
    }

    if (target.replyTo) {
      const result = await this.client.im.message.reply({
        path: {
          message_id: target.replyTo
        },
        data: {
          content: JSON.stringify(content),
          msg_type: msgType,
          reply_in_thread: target.replyInThread
        }
      });
      return getMessageId(result);
    }

    const result = await this.client.im.message.create({
      params: {
        receive_id_type: target.receiveIdType
      },
      data: {
        receive_id: target.receiveId,
        content: JSON.stringify(content),
        msg_type: msgType
      }
    });
    return getMessageId(result);
  }
}

type FeishuEventData = {
  header?: {
    event_id?: string;
  };
  message?: {
    message_id?: string;
    root_id?: string;
    parent_id?: string;
    chat_id?: string;
    chat_type?: string;
    content?: unknown;
  };
  sender?: {
    sender_id?: {
      open_id?: string;
      union_id?: string;
      user_id?: string;
    };
    sender_type?: string;
    tenant_key?: string;
  };
};

function normalizeFeishuEvent(data: FeishuEventData): FeishuReceivedMessage | null {
  const message = data.message;
  if (!message?.chat_id) return null;

  const senderId = data.sender?.sender_id?.open_id ?? data.sender?.sender_id?.user_id;

  return {
    eventId: data.header?.event_id,
    messageId: message.message_id,
    chatId: message.chat_id,
    chatType: message.chat_type,
    senderId,
    threadId: message.root_id ?? message.parent_id,
    text: extractTextContent(message.content)
  };
}

function dedupKey(message: FeishuReceivedMessage): string {
  return message.eventId || message.messageId || "";
}

function logReceivedMessage(message: FeishuReceivedMessage): void {
  const preview = message.text.replace(/\s+/g, " ").slice(0, 120);
  console.log(
    `feishu message received: chat=${message.chatId ?? ""} message=${message.messageId ?? ""} thread=${message.threadId ?? ""} len=${message.text.length} preview=${preview}`
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getMessageId(result: { data?: { message_id?: string } }): string {
  const messageId = result.data?.message_id;
  if (!messageId) throw new Error("Feishu message_id missing from send response");
  return messageId;
}

function inferFeishuFileType(fileName: string): "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream" {
  const ext = extname(fileName).toLowerCase();
  if ([".mp4", ".mov", ".m4v", ".avi"].includes(ext)) return "mp4";
  if ([".mp3", ".wav", ".m4a", ".ogg", ".opus"].includes(ext)) return "opus";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext)) return "doc";
  if ([".xls", ".xlsx", ".csv"].includes(ext)) return "xls";
  if ([".ppt", ".pptx"].includes(ext)) return "ppt";
  return "stream";
}

class MessageDedup {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs = 10 * 60 * 1000) {}

  isDuplicate(key: string): boolean {
    if (!key) return false;

    const now = Date.now();
    for (const [cachedKey, ts] of this.seen) {
      if (now - ts > this.ttlMs) {
        this.seen.delete(cachedKey);
      }
    }

    if (this.seen.has(key)) return true;
    this.seen.set(key, now);
    return false;
  }
}
