import { ChannelId, type AgentRunParams } from "../types.js";
import type { FeishuConfig } from "./config.js";

export type FeishuReceivedMessage = {
  eventId?: string;
  messageId?: string;
  chatId?: string;
  chatType?: string;
  senderId?: string;
  senderName?: string;
  threadId?: string;
  text: string;
};

export type FeishuSendTarget = {
  receiveIdType: "chat_id" | "open_id";
  receiveId: string;
  replyTo?: string;
  replyInThread?: boolean;
};

export type ResolveSendTargetOptions = {
  reply?: boolean;
};

export type FeishuAnswerCardState = {
  assistantText: string;
  toolMessages: string[];
  elapsedMs?: number;
  errorText?: string;
};

export const FEISHU_STREAM_CONTENT_ELEMENT_ID = "streaming_content";
export const FEISHU_LOADING_ELEMENT_ID = "loading_indicator";

export type FeishuStreamingPhase = "thinking" | "answering" | "tool";

export function toAgentRunParams(event: FeishuReceivedMessage, config: FeishuConfig): AgentRunParams | null {
  if (!event.chatId) return null;
  if (!event.text.trim()) return null;

  return {
    channelId: ChannelId.Feishu,
    appId: config.appId,
    groupId: event.chatId,
    threadId: event.threadId,
    senderId: event.senderId,
    senderName: event.senderName,
    replyTo: event.messageId,
    content: event.text,
    isPrivate: event.chatType === "p2p",
    source: "user"
  };
}

export function resolveSendTarget(message: AgentRunParams, options: ResolveSendTargetOptions = {}): FeishuSendTarget {
  if (options.reply !== false && message.replyTo) {
    return {
      receiveIdType: "chat_id",
      receiveId: message.groupId,
      replyTo: message.replyTo,
      replyInThread: Boolean(message.threadId)
    };
  }

  return {
    receiveIdType: "chat_id",
    receiveId: message.groupId
  };
}

export function buildAnswerCard(text: string): Record<string, unknown> {
  return buildFinalAnswerCard({
    assistantText: text,
    toolMessages: []
  });
}

export function buildFinalAnswerCard(state: FeishuAnswerCardState): Record<string, unknown> {
  const text = normalizeCardMarkdown(state.errorText ? `抱歉，处理消息时遇到错误：${state.errorText}` : state.assistantText);
  const elements: Record<string, unknown>[] = [];
  if (state.toolMessages.length) {
    elements.push(buildToolPanel(state.toolMessages));
  }
  elements.push({
    tag: "markdown",
    content: text || (state.errorText ? "处理失败。" : " "),
    text_align: "left",
    text_size: "normal_v2"
  });
  const elapsed = formatElapsed(state.elapsedMs);
  if (elapsed) {
    elements.push({
      tag: "markdown",
      content: `<font color='grey'>${elapsed}</font>`,
      text_size: "notation"
    });
  }

  const summary = buildSummary(text, Boolean(state.errorText));

  return {
    schema: "2.0",
    config: {
      streaming_mode: false,
      locales: ["zh_cn", "en_us"],
      summary: {
        content: summary,
        i18n_content: {
          zh_cn: summary,
          en_us: summary
        }
      }
    },
    body: {
      elements
    }
  };
}

export function buildStreamingCard(state: FeishuAnswerCardState, phase: FeishuStreamingPhase, loadingDots = "..."): Record<string, unknown> {
  const elements: Record<string, unknown>[] = [];
  if (state.toolMessages.length) {
    elements.push(buildToolPanel(state.toolMessages, true));
  }

  elements.push({
    tag: "markdown",
    content: normalizeCardMarkdown(state.assistantText),
    text_align: "left",
    text_size: "normal_v2",
    margin: "0px 0px 0px 0px",
    element_id: FEISHU_STREAM_CONTENT_ELEMENT_ID
  });

  elements.push({
    tag: "markdown",
    content: buildLoadingContent(phase, loadingDots),
    text_size: "notation",
    element_id: FEISHU_LOADING_ELEMENT_ID
  });

  const summary = loadingText(phase);
  return {
    schema: "2.0",
    config: {
      streaming_mode: true,
      locales: ["zh_cn", "en_us"],
      summary: {
        content: summary,
        i18n_content: {
          zh_cn: summary,
          en_us: "Processing"
        }
      }
    },
    body: {
      elements
    }
  };
}

export function extractTextContent(content: unknown): string {
  if (typeof content !== "string") return "";

  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return content;
  }
}

function normalizeCardMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, "**$1**")
    .replace(/`(https?:\/\/[^\s`]+)`/g, "$1")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeInline(text: string): string {
  return normalizeCardMarkdown(text).replace(/\s+/g, " ").slice(0, 300);
}

function buildToolPanel(toolMessages: string[], expanded = false): Record<string, unknown> {
  const title = `工具执行 · ${toolMessages.length} 步`;
  return {
    tag: "collapsible_panel",
    expanded,
    header: {
      title: {
        tag: "plain_text",
        content: title,
        i18n_content: {
          zh_cn: title,
          en_us: `Tool use · ${toolMessages.length} steps`
        },
        text_color: "grey",
        text_size: "notation"
      },
      vertical_align: "center",
      icon: {
        tag: "standard_icon",
        token: "down-small-ccm_outlined",
        color: "grey",
        size: "16px 16px"
      },
      icon_position: "right",
      icon_expanded_angle: -180
    },
    border: {
      color: "grey",
      corner_radius: "5px"
    },
    vertical_spacing: "4px",
    padding: "8px 8px 8px 8px",
    elements: toolMessages.slice(-20).map(buildToolStep)
  };
}

function buildToolStep(message: string): Record<string, unknown> {
  const [title = "工具调用", ...details] = normalizeCardMarkdown(message).split("\n");
  const detail = details.join("\n").trim();
  const content = detail ? `**${normalizeInline(title)}**\n<font color='grey'>${normalizeInline(detail)}</font>` : `**${normalizeInline(title)}**`;

  return {
    tag: "markdown",
    content,
    text_size: "notation",
    margin: "0px 0px 0px 0px"
  };
}

function buildSummary(text: string, isError: boolean): string {
  if (isError) return "出错";
  const preview = text.trim().slice(0, 50).replace(/\n/g, " ");
  if (!preview) return " ";
  return text.trim().length > 50 ? `${preview}...` : preview;
}

function formatElapsed(elapsedMs: number | undefined): string {
  if (typeof elapsedMs !== "number") return "";
  return `耗时 ${(elapsedMs / 1000).toFixed(1)}s`;
}

function loadingText(phase: FeishuStreamingPhase): string {
  if (phase === "tool") return "执行工具";
  if (phase === "answering") return "输出中";
  return "思考中";
}

export function buildLoadingContent(phase: FeishuStreamingPhase, dots: string): string {
  return `<font color='grey'>${loadingText(phase)}${dots}</font>`;
}
