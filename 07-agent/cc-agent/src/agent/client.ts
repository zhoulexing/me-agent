import { query, type Query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AppEnv } from "../config/index.js";
import { buildClientOptions } from "./client-option.js";
import type { AgentRunCallbacks, AgentRunParams } from "./model.js";
import { formatToolDisplay } from "./tool-display.js";

export type ClaudeRunParams = {
  prompt: string;
  config: AppEnv;
  sessionKey: string;
  threadId: string;
  agentSessionId?: string | null;
  message?: AgentRunParams;
  callbacks?: AgentRunCallbacks;
  includePartialMessages?: boolean;
  onEvent?: (event: ClaudeStreamEvent) => void | Promise<void>;
};

export type ClaudeRunResult = {
  text: string;
  toolMessages: string[];
  agentSessionId?: string;
};

export type ClaudeStreamEvent =
  | { type: "assistant"; content: string; agentSessionId?: string }
  | { type: "tool"; content: string; agentSessionId?: string }
  | { type: "result"; content: string; agentSessionId?: string }
  | { type: "error"; content: string; agentSessionId?: string };

export class ClaudeAgentClient {
  private readonly activeQueries = new Set<Query>();

  async run(params: ClaudeRunParams): Promise<ClaudeRunResult> {
    const assistantChunks: string[] = [];
    const toolMessages: string[] = [];
    let resultText = "";
    let agentSessionId = params.agentSessionId ?? undefined;
    let sawPartial = false;

    const stream = this.query(params);

    try {
      for await (const message of stream) {
        agentSessionId = getAgentSessionId(message) ?? agentSessionId;
        for (const event of toStreamEvents(message, agentSessionId, sawPartial)) {
          if (event.type === "tool") mergeToolMessage(toolMessages, event.content);
          await params.onEvent?.(event);
        }
        if (message.type === "stream_event") sawPartial = true;

        if (message.type === "assistant") {
          assistantChunks.push(extractTextContent(message.message.content));
          continue;
        }

        if (message.type !== "result") continue;
        if (message.subtype !== "success") {
          throw new Error(message.errors.join("\n") || message.subtype);
        }
        resultText = message.result;
      }

      return {
        text: (resultText || assistantChunks.join("")).trim(),
        toolMessages,
        agentSessionId
      };
    } finally {
      this.activeQueries.delete(stream);
    }
  }

  async interrupt(): Promise<void> {
    await Promise.all([...this.activeQueries].map((activeQuery) => activeQuery.interrupt()));
  }

  private query(params: ClaudeRunParams): Query {
    const stream = query({
      prompt: params.prompt,
      options: buildClientOptions(params)
    });
    this.activeQueries.add(stream);
    return stream;
  }
}

function mergeToolMessage(messages: string[], message: string): void {
  if (!message) return;

  const existingIndex = messages.findIndex((existing) => existing === message || isMoreDetailedToolMessage(message, existing));
  if (existingIndex >= 0) {
    messages[existingIndex] = chooseMoreDetailedToolMessage(messages[existingIndex], message);
    return;
  }

  if (messages.some((existing) => isMoreDetailedToolMessage(existing, message))) return;
  messages.push(message);
}

function isMoreDetailedToolMessage(candidate: string, base: string): boolean {
  return candidate.startsWith(`${base}:`) || candidate.startsWith(`${base} (`);
}

function chooseMoreDetailedToolMessage(current: string, next: string): string {
  return next.length > current.length ? next : current;
}

function toStreamEvents(message: SDKMessage, agentSessionId: string | undefined, sawPartial: boolean): ClaudeStreamEvent[] {
  if (message.type === "assistant") {
    if (sawPartial) return extractToolUseEvents(message.message.content, agentSessionId);
    return extractAssistantEvents(message.message.content, agentSessionId);
  }

  if (message.type === "stream_event") {
    const content = extractPartialContent(message.event);
    if (content) return [{ type: "assistant", content, agentSessionId }];

    const toolUse = extractPartialToolUse(message.event);
    return toolUse ? [{ type: "tool", content: toolUse, agentSessionId }] : [];
  }

  if (message.type === "result") {
    if (message.subtype === "success") {
      return [{ type: "result", content: message.result, agentSessionId }];
    }
    return [{ type: "error", content: message.errors.join("\n") || message.subtype, agentSessionId }];
  }

  if (message.type === "system" && "subtype" in message && message.subtype === "permission_denied") {
    return [{ type: "tool", content: `Permission denied: ${message.tool_name}`, agentSessionId }];
  }

  if (message.type === "tool_use_summary") {
    return [{ type: "tool", content: message.summary, agentSessionId }];
  }

  return [];
}

function extractAssistantEvents(content: unknown, agentSessionId: string | undefined): ClaudeStreamEvent[] {
  const events: ClaudeStreamEvent[] = [];
  for (const item of normalizeContentItems(content)) {
    const text = getText(item);
    if (text) events.push({ type: "assistant", content: text, agentSessionId });

    const toolUse = formatToolUse(item);
    if (toolUse) events.push({ type: "tool", content: toolUse, agentSessionId });
  }
  return events;
}

function extractToolUseEvents(content: unknown, agentSessionId: string | undefined): ClaudeStreamEvent[] {
  return normalizeContentItems(content)
    .map((item) => formatToolUse(item))
    .filter((content): content is string => Boolean(content))
    .map((content) => ({ type: "tool", content, agentSessionId }));
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  return normalizeContentItems(content).map(getText).join("");
}

function normalizeContentItems(content: unknown): unknown[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? content : [];
}

function getText(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const value = (item as { text?: unknown }).text;
  return typeof value === "string" ? value : "";
}

function formatToolUse(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const record = item as { type?: unknown; id?: unknown; name?: unknown; input?: unknown };
  if (record.type !== "tool_use") return "";

  const name = typeof record.name === "string" ? record.name : "tool";
  return formatToolDisplay(name, record.input);
}

function extractPartialContent(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const delta = (event as { delta?: unknown }).delta;
  if (!delta || typeof delta !== "object") return "";
  const text = (delta as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

function extractPartialToolUse(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const record = event as { type?: unknown; content_block?: unknown };
  if (record.type !== "content_block_start") return "";
  return formatToolUse(record.content_block);
}

function getAgentSessionId(message: SDKMessage): string | undefined {
  const value = (message as { session_id?: unknown }).session_id;
  return typeof value === "string" ? value : undefined;
}
