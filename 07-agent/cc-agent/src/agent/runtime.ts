import type { AppEnv } from "../config/index.js";
import type { Repositories } from "../db/index.js";
import { ClaudeAgentClient, type ClaudeStreamEvent } from "./client.js";
import type { AgentRunCallbacks, AgentRunParams, AgentRunResult } from "./model.js";
import { SessionQueue } from "./queue.js";
import { buildQueueKey, buildSessionKey, normalizeThreadId } from "./session-key.js";

export type AgentRuntimeOptions = {
  config: AppEnv;
  repositories: Repositories;
  client?: ClaudeAgentClient;
  queue?: SessionQueue;
};

export class AgentRuntime {
  private readonly client: ClaudeAgentClient;
  private readonly queue: SessionQueue;

  constructor(private readonly options: AgentRuntimeOptions) {
    this.client = options.client ?? new ClaudeAgentClient();
    this.queue = options.queue ?? new SessionQueue();
  }

  run(params: AgentRunParams, callbacks: AgentRunCallbacks = {}): Promise<AgentRunResult> {
    const queueKey = buildQueueKey(params);
    return this.queue.enqueue(queueKey, () => this._run(params, callbacks));
  }

  private async _run(params: AgentRunParams, callbacks: AgentRunCallbacks): Promise<AgentRunResult> {
    const startedAt = Date.now();
    const sessionKey = buildSessionKey(params);
    if (!params.content.trim()) {
      return this.finish(callbacks, {
        sessionKey,
        text: "",
        toolMessages: [],
        status: "success",
        elapsedMs: Date.now() - startedAt
      });
    }

    const threadId = normalizeThreadId(params.threadId);
    const session = this.options.repositories.sessions.getOrCreate(sessionKey, threadId);
    const input = this.options.repositories.messages.createInbound(session.id, params);
    const run = this.options.repositories.runs.start(session.id, input.id);
    const toolMessages: string[] = [];

    this.options.repositories.sessions.updateLastRoute({
      id: session.id,
      replyTo: params.replyTo,
      senderId: params.senderId,
      senderName: params.senderName,
      isPrivate: params.isPrivate
    });

    await callbacks.onEvent?.({ type: "metadata", sessionKey, agentSessionId: session.agent_session_id ?? undefined });

    try {
      const result = await this.client.run({
        prompt: params.content,
        config: this.options.config,
        sessionKey,
        threadId,
        agentSessionId: session.agent_session_id,
        message: params,
        callbacks,
        includePartialMessages: callbacks.stream === true,
        onEvent: async (event) => {
          await this.handleClientEvent(event, callbacks, toolMessages);
        }
      });

      if (result.agentSessionId && result.agentSessionId !== session.agent_session_id) {
        this.options.repositories.sessions.updateAgentSessionId(session.id, result.agentSessionId);
      }

      const finalToolMessages = result.toolMessages.length ? result.toolMessages : toolMessages;
      if (result.text) {
        this.options.repositories.messages.createOutbound(session.id, result.text);
      }

      for (const toolMessage of finalToolMessages) {
        this.options.repositories.runs.addEvent(run.id, "tool_message", toolMessage);
      }
      this.options.repositories.runs.addEvent(run.id, "assistant_text", result.text);
      this.options.repositories.runs.finish(run.id);

      return this.finish(callbacks, {
        sessionKey,
        agentSessionId: result.agentSessionId ?? session.agent_session_id ?? undefined,
        text: result.text,
        toolMessages: finalToolMessages,
        status: "success",
        elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.options.repositories.runs.fail(run.id, error);
      await callbacks.onError?.({ type: "error", error: message });
      await callbacks.onEvent?.({ type: "error", error: message });
      return this.finish(callbacks, {
        sessionKey,
        agentSessionId: session.agent_session_id ?? undefined,
        text: "",
        toolMessages,
        status: "error",
        error: message,
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  private async handleClientEvent(event: ClaudeStreamEvent, callbacks: AgentRunCallbacks, toolMessages: string[]): Promise<void> {
    if (event.type === "assistant") {
      const message = { type: "message" as const, content: event.content, agentSessionId: event.agentSessionId };
      await callbacks.onMessage?.(message);
      await callbacks.onEvent?.(message);
      return;
    }

    if (event.type === "tool") {
      mergeToolMessage(toolMessages, event.content);
      const tool = { type: "tool" as const, content: event.content, agentSessionId: event.agentSessionId };
      await callbacks.onTool?.(tool);
      await callbacks.onEvent?.(tool);
      return;
    }

    if (event.type === "result") {
      await callbacks.onEvent?.({ type: "result", content: event.content, agentSessionId: event.agentSessionId });
      return;
    }

    if (event.type === "error") {
      await callbacks.onError?.({ type: "error", error: event.content });
      await callbacks.onEvent?.({ type: "error", error: event.content });
    }
  }

  private async finish(callbacks: AgentRunCallbacks, result: AgentRunResult): Promise<AgentRunResult> {
    await callbacks.onFinish?.({ type: "finish", result });
    await callbacks.onEvent?.({ type: "finish", result });
    return result;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
