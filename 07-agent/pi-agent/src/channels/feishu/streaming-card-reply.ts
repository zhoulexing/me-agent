import { basename } from "node:path";
import type { AgentRuntime } from "../../agent/runtime.js";
import type { AgentRunParams } from "../types.js";
import type { FeishuClient } from "./client.js";
import {
  FEISHU_LOADING_ELEMENT_ID,
  FEISHU_STREAM_CONTENT_ELEMENT_ID,
  buildFinalAnswerCard,
  buildLoadingContent,
  buildStreamingCard,
  resolveSendTarget,
  type FeishuAnswerCardState,
  type FeishuStreamingPhase
} from "./message.js";

export async function replyWithStreamingCard(
  client: FeishuClient,
  agent: AgentRuntime,
  message: AgentRunParams,
  sourceMessageId?: string,
  getReactionId?: string
): Promise<void> {
  const state: FeishuAnswerCardState = {
    assistantText: "",
    toolMessages: []
  };
  const reply = new FeishuStreamingReply(client, message, state);
  const startedAt = Date.now();
  let streamingReady = false;

  try {
    try {
      await reply.start();
      streamingReady = true;
      await client.deleteReaction(sourceMessageId, getReactionId);
    } catch (error) {
      console.warn(`feishu streaming card unavailable, fallback to static card: message=${sourceMessageId ?? ""} error=${getErrorMessage(error)}`);
    }

    const result = await agent.run(message, {
      onMessage: async (event) => {
        if (!streamingReady) {
          state.assistantText += event.content;
          return;
        }
        try {
          await reply.addAssistant(event.content);
        } catch (error) {
          streamingReady = false;
          console.warn(`feishu streaming card update failed, fallback to static card: message=${sourceMessageId ?? ""} error=${getErrorMessage(error)}`);
        }
      },
      onTool: async (event) => {
        if (!streamingReady) {
          mergeToolMessage(state.toolMessages, event.content);
          return;
        }
        try {
          await reply.addTool(event.content);
        } catch (error) {
          streamingReady = false;
          console.warn(`feishu streaming card update failed, fallback to static card: message=${sourceMessageId ?? ""} error=${getErrorMessage(error)}`);
        }
      },
      onImage: async (event) => {
        await client.sendImage(resolveSendTarget(message, { reply: false }), event.filePath);
      },
      onFile: async (event) => {
        await client.sendFile(resolveSendTarget(message, { reply: false }), event.filePath, event.fileName || basename(event.filePath));
      },
      onError: async (event) => {
        state.errorText = event.error;
      }
    });

    if (result.status === "error") {
      state.errorText = result.error || state.errorText || "处理失败";
    }
    if (result.text && state.assistantText.trim() !== result.text.trim()) {
      state.assistantText = result.text;
    }
    state.toolMessages = result.toolMessages;
    state.elapsedMs = Date.now() - startedAt;

    try {
      if (streamingReady) {
        await reply.finish();
        return;
      }
      await sendStaticCard(client, message, state);
      await client.deleteReaction(sourceMessageId, getReactionId);
    } catch (error) {
      console.warn(`feishu streaming card finish failed, fallback to static card: message=${sourceMessageId ?? ""} error=${getErrorMessage(error)}`);
      await sendStaticCard(client, message, state);
      await client.deleteReaction(sourceMessageId, getReactionId);
    }
  } catch (error) {
    state.errorText = getErrorMessage(error);
    state.elapsedMs = Date.now() - startedAt;
    console.error(`feishu streaming reply failed: message=${sourceMessageId ?? ""} error=${state.errorText}`);
    try {
      if (streamingReady) {
        await reply.finish(true);
      } else {
        await sendStaticCard(client, message, state);
      }
      await client.deleteReaction(sourceMessageId, getReactionId);
    } catch (sendError) {
      console.error(`feishu streaming error card failed: message=${sourceMessageId ?? ""} error=${getErrorMessage(sendError)}`);
    }
  }
}

class FeishuStreamingReply {
  private cardId = "";
  private sequence = 0;
  private phase: FeishuStreamingPhase = "thinking";
  private lastFlushAt = 0;
  private lastFlushedLength = 0;
  private loadingTick = 0;
  private loadingTimer?: ReturnType<typeof setInterval>;
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly client: FeishuClient,
    private readonly message: AgentRunParams,
    private readonly state: FeishuAnswerCardState,
    private readonly flushIntervalMs = 700
  ) {}

  async start(): Promise<void> {
    if (this.cardId) return;
    this.cardId = await this.client.createCardInstance(buildStreamingCard(this.state, this.phase));
    await this.client.sendCardReference(resolveSendTarget(this.message), this.cardId);
    this.startLoadingTicker();
  }

  async addAssistant(content: string): Promise<void> {
    if (!content) return;
    this.state.assistantText += content;
    if (this.phase !== "answering") {
      this.phase = "answering";
      await this.updateCard(buildStreamingCard(this.state, this.phase, ".".repeat(this.loadingTick || 1)));
    }
    await this.flushContent(false);
  }

  async addTool(content: string): Promise<void> {
    if (!content) return;
    mergeToolMessage(this.state.toolMessages, content);
    this.phase = "tool";
    await this.updateCard(buildStreamingCard(this.state, this.phase, ".".repeat(this.loadingTick || 1)));
  }

  async finish(isError = false): Promise<void> {
    await this.start();
    this.stopLoadingTicker();
    if (this.state.assistantText) {
      await this.flushContent(true);
    }
    if (isError && !this.state.errorText) {
      this.state.errorText = "处理失败";
    }
    await this.updateCard(buildFinalAnswerCard(this.state));
    await this.enqueueUpdate(() => this.client.finishStreamingCard(this.cardId, buildSummary(this.state), this.nextSequence()));
  }

  private async flushContent(force: boolean): Promise<void> {
    const now = Date.now();
    const pendingChars = this.state.assistantText.length - this.lastFlushedLength;
    if (!force && now - this.lastFlushAt < this.flushIntervalMs && pendingChars < 80) return;
    this.lastFlushAt = now;
    this.lastFlushedLength = this.state.assistantText.length;
    await this.enqueueUpdate(() =>
      this.client.updateCardElementContent(
        this.cardId,
        FEISHU_STREAM_CONTENT_ELEMENT_ID,
        this.state.assistantText,
        this.nextSequence()
      )
    );
  }

  private async updateCard(card: Record<string, unknown>): Promise<void> {
    await this.enqueueUpdate(() => this.client.updateCardInstance(this.cardId, card, this.nextSequence()));
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private startLoadingTicker(): void {
    if (this.loadingTimer) return;
    this.loadingTimer = setInterval(() => {
      void this.updateLoadingDots().catch((error) => {
        console.warn(`feishu loading ticker failed: ${getErrorMessage(error)}`);
      });
    }, 550);
  }

  private stopLoadingTicker(): void {
    if (!this.loadingTimer) return;
    clearInterval(this.loadingTimer);
    this.loadingTimer = undefined;
  }

  private async updateLoadingDots(): Promise<void> {
    if (!this.cardId) return;
    this.loadingTick = (this.loadingTick % 3) + 1;
    const dots = ".".repeat(this.loadingTick);
    await this.enqueueUpdate(() =>
      this.client.updateCardElementContent(
        this.cardId,
        FEISHU_LOADING_ELEMENT_ID,
        buildLoadingContent(this.phase, dots),
        this.nextSequence()
      )
    );
  }

  private async enqueueUpdate(task: () => Promise<void>): Promise<void> {
    const run = this.updateQueue.then(task);
    this.updateQueue = run.catch(() => undefined);
    await run;
  }
}

async function sendStaticCard(client: FeishuClient, message: AgentRunParams, state: FeishuAnswerCardState): Promise<void> {
  await client.sendCard(resolveSendTarget(message), buildFinalAnswerCard(state));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildSummary(state: FeishuAnswerCardState): string {
  if (state.errorText) return "出错";
  const preview = state.assistantText.trim().replace(/\s+/g, " ").slice(0, 50);
  if (preview) return preview;
  if (state.toolMessages.length) return `工具执行 · ${state.toolMessages.length} 步`;
  return "已完成";
}

function mergeToolMessage(messages: string[], message: string): void {
  const existingIndex = messages.findIndex((existing) => existing === message || isMoreDetailedToolMessage(message, existing));
  if (existingIndex >= 0) {
    messages[existingIndex] = message.length > messages[existingIndex].length ? message : messages[existingIndex];
    return;
  }
  if (messages.some((existing) => isMoreDetailedToolMessage(existing, message))) return;
  messages.push(message);
}

function isMoreDetailedToolMessage(candidate: string, base: string): boolean {
  return candidate.startsWith(`${base}:`) || candidate.startsWith(`${base} (`);
}
