import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import type { AppEnv } from "../config/index.js";
import { buildPiSessionOptions } from "./client-option.js";
import type { AgentRunCallbacks, AgentRunParams } from "./model.js";
import { formatToolDisplay } from "./tool-display.js";

export type PiRunParams = {
  prompt: string;
  config: AppEnv;
  sessionKey: string;
  threadId: string;
  agentSessionId?: string | null;
  message?: AgentRunParams;
  callbacks?: AgentRunCallbacks;
  includePartialMessages?: boolean;
  onEvent?: (event: PiStreamEvent) => void | Promise<void>;
};

export type PiRunResult = {
  text: string;
  toolMessages: string[];
  agentSessionId?: string;
};

export type PiStreamEvent =
  | { type: "assistant"; content: string; agentSessionId?: string }
  | { type: "tool"; content: string; agentSessionId?: string }
  | { type: "result"; content: string; agentSessionId?: string }
  | { type: "error"; content: string; agentSessionId?: string };

export class PiAgentClient {
  private readonly activeSessions = new Set<AgentSession>();

  async run(params: PiRunParams): Promise<PiRunResult> {
    const options = await buildPiSessionOptions({
      config: params.config,
      sessionKey: params.sessionKey,
      threadId: params.threadId,
      agentSessionId: params.agentSessionId,
      context: {
        cwd: "",
        message: params.message,
        callbacks: params.callbacks
      }
    });
    const { session } = await createAgentSession(options);
    this.activeSessions.add(session);

    const assistantChunks: string[] = [];
    const toolMessages: string[] = [];
    const pendingEvents: Array<Promise<void>> = [];
    let errorMessage = "";

    const unsubscribe = session.subscribe((event) => {
      const streamEvents = toStreamEvents(event, session.sessionId, params.includePartialMessages === true);
      pendingEvents.push(Promise.all(streamEvents.map(async (streamEvent) => {
        if (streamEvent.type === "assistant") assistantChunks.push(streamEvent.content);
        if (streamEvent.type === "tool") mergeToolMessage(toolMessages, streamEvent.content);
        if (streamEvent.type === "error") errorMessage = streamEvent.content;
        await params.onEvent?.(streamEvent);
      })).then(() => undefined));
    });

    try {
      await session.prompt(params.prompt, { source: "rpc" });
      await drainPendingEvents(pendingEvents);
      const text = extractLastAssistantText(session) || assistantChunks.join("");
      if (errorMessage) throw new Error(errorMessage);
      await params.onEvent?.({ type: "result", content: text, agentSessionId: session.sessionId });
      return {
        text: text.trim(),
        toolMessages,
        agentSessionId: session.sessionId
      };
    } finally {
      unsubscribe();
      session.dispose();
      this.activeSessions.delete(session);
    }
  }

  async interrupt(): Promise<void> {
    await Promise.all([...this.activeSessions].map((session) => session.abort()));
  }
}

export function toStreamEvents(event: AgentSessionEvent, agentSessionId: string, includePartialMessages: boolean): PiStreamEvent[] {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    return includePartialMessages ? [{ type: "assistant", content: event.assistantMessageEvent.delta, agentSessionId }] : [];
  }

  if (event.type === "message_end") {
    const text = extractAssistantText(event.message);
    if (text) return [{ type: "assistant", content: text, agentSessionId }];
    const error = extractAssistantError(event.message);
    return error ? [{ type: "error", content: error, agentSessionId }] : [];
  }

  if (event.type === "tool_execution_start") {
    return [{ type: "tool", content: formatToolDisplay(event.toolName, event.args), agentSessionId }];
  }

  if (event.type === "auto_retry_end" && !event.success && event.finalError) {
    return [{ type: "error", content: event.finalError, agentSessionId }];
  }

  return [];
}

function extractLastAssistantText(session: AgentSession): string {
  const lastAssistantMessage = [...session.state.messages].reverse().find((message) => {
    return message && typeof message === "object" && (message as { role?: unknown }).role === "assistant";
  });
  return extractAssistantText(lastAssistantMessage);
}

function extractAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const candidate = message as { role?: unknown; content?: unknown };
  if (candidate.role !== "assistant") return "";

  if (typeof candidate.content === "string") return candidate.content;
  if (!Array.isArray(candidate.content)) return "";

  return candidate.content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as { type?: unknown; text?: unknown };
      return record.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .join("");
}

function extractAssistantError(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const candidate = message as { role?: unknown; errorMessage?: unknown; stopReason?: unknown };
  if (candidate.role !== "assistant") return "";
  if (candidate.stopReason !== "error" && candidate.stopReason !== "aborted") return "";
  return typeof candidate.errorMessage === "string" && candidate.errorMessage.trim() ? candidate.errorMessage : String(candidate.stopReason);
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

async function drainPendingEvents(events: Array<Promise<void>>): Promise<void> {
  for (let index = 0; index < events.length; index += 1) {
    await events[index];
  }
}
