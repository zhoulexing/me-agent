import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/agent/runtime.js";
import { PiAgentClient, type PiRunParams, type PiRunResult } from "../../src/agent/client.js";
import { ChannelId } from "../../src/channels/types.js";
import type { AppEnv } from "../../src/config/index.js";
import { createRepositories } from "../../src/db/index.js";

describe("AgentRuntime", () => {
  it("persists channel messages, sdk events, run events, and callback output", async () => {
    const repositories = createRepositories(mkdtempSync(join(tmpdir(), "pi-agent-runtime-test-")));
    const runtime = new AgentRuntime({
      config: createEnv(),
      repositories,
      client: new FakePiClient()
    });
    const callbackEvents: string[] = [];

    try {
      const result = await runtime.run(
        {
          channelId: ChannelId.Wechat,
          appId: "local",
          groupId: "group-1",
          threadId: "thread-1",
          senderId: "user-1",
          senderName: "User",
          replyTo: "message-1",
          content: "你好",
          isPrivate: true,
          source: "user"
        },
        {
          onMessage: async (event) => callbackEvents.push(`message:${event.content}`),
          onTool: async (event) => callbackEvents.push(`tool:${event.content}`),
          onFinish: async (event) => callbackEvents.push(`finish:${event.result.status}`),
          onEvent: async (event) => callbackEvents.push(`event:${event.type}`)
        }
      );

      expect(result).toMatchObject({
        sessionKey: "wechat:local:group-1",
        agentSessionId: "agent-session-1",
        text: "你好",
        toolMessages: ["执行命令 (command=ls)"],
        status: "success"
      });
      expect(callbackEvents).toContain("message:你好");
      expect(callbackEvents).toContain("tool:执行命令 (command=ls)");
      expect(callbackEvents).toContain("finish:success");

      const session = repositories.db.prepare("SELECT * FROM agent_sessions").get() as Record<string, unknown>;
      expect(session).toMatchObject({
        session_key: "wechat:local:group-1",
        thread_id: "thread-1",
        agent_session_id: "agent-session-1",
        last_reply_to: "message-1",
        last_sender_id: "user-1",
        last_sender_name: "User",
        last_is_private: 1
      });

      const messages = repositories.db.prepare("SELECT direction, source, content FROM channel_messages ORDER BY id").all();
      expect(messages).toEqual([
        { direction: "inbound", source: "user", content: "你好" },
        { direction: "outbound", source: "background", content: "你好" }
      ]);

      const run = repositories.db.prepare("SELECT status, error FROM agent_runs").get();
      expect(run).toEqual({ status: "finished", error: null });

      const runEvents = repositories.db.prepare("SELECT event_type, content FROM agent_run_events ORDER BY id").all();
      expect(runEvents).toEqual([
        { event_type: "tool_message", content: "执行命令 (command=ls)" },
        { event_type: "assistant_text", content: "你好" }
      ]);

      const sdkEvents = repositories.db.prepare("SELECT event_name FROM sdk_events ORDER BY id").all();
      expect(sdkEvents).toEqual([{ event_name: "tool" }, { event_name: "assistant" }, { event_name: "result" }]);
    } finally {
      repositories.db.close();
    }
  });

  it("persists failed runs and calls error callbacks", async () => {
    const repositories = createRepositories(mkdtempSync(join(tmpdir(), "pi-agent-runtime-error-test-")));
    const runtime = new AgentRuntime({
      config: createEnv(),
      repositories,
      client: new FailingPiClient()
    });
    const callbackEvents: string[] = [];

    try {
      const result = await runtime.run(
        {
          channelId: ChannelId.Feishu,
          appId: "cli-test",
          groupId: "chat-1",
          content: "失败一下",
          isPrivate: false,
          source: "user"
        },
        {
          onError: async (event) => callbackEvents.push(`error:${event.error}`),
          onFinish: async (event) => callbackEvents.push(`finish:${event.result.status}`),
          onEvent: async (event) => callbackEvents.push(`event:${event.type}`)
        }
      );

      expect(result).toMatchObject({
        sessionKey: "feishu:cli-test:chat-1",
        text: "",
        toolMessages: [],
        status: "error",
        error: "model failed"
      });
      expect(callbackEvents).toContain("error:model failed");
      expect(callbackEvents).toContain("finish:error");

      const run = repositories.db.prepare("SELECT status, error FROM agent_runs").get();
      expect(run).toEqual({ status: "failed", error: "model failed" });

      const messages = repositories.db.prepare("SELECT direction, content FROM channel_messages ORDER BY id").all();
      expect(messages).toEqual([{ direction: "inbound", content: "失败一下" }]);
    } finally {
      repositories.db.close();
    }
  });

  it("uses runStream as the explicit streaming entrypoint", async () => {
    const repositories = createRepositories(mkdtempSync(join(tmpdir(), "pi-agent-runtime-stream-test-")));
    const client = new StreamFlagPiClient();
    const runtime = new AgentRuntime({
      config: createEnv(),
      repositories,
      client
    });
    const message = {
      channelId: ChannelId.Wechat,
      appId: "local",
      groupId: "stream-group",
      content: "stream?",
      isPrivate: true,
      source: "user" as const
    };

    try {
      await runtime.run(message, { stream: true });
      await runtime.runStream(message);

      expect(client.partialFlags).toEqual([false, true]);
    } finally {
      repositories.db.close();
    }
  });
});

class FakePiClient extends PiAgentClient {
  override async run(params: PiRunParams): Promise<PiRunResult> {
    await params.onEvent?.({ type: "tool", content: "执行命令 (command=ls)", agentSessionId: "agent-session-1" });
    await params.onEvent?.({ type: "assistant", content: "你好", agentSessionId: "agent-session-1" });
    await params.onEvent?.({ type: "result", content: "你好", agentSessionId: "agent-session-1" });

    return {
      text: "你好",
      toolMessages: ["执行命令 (command=ls)"],
      agentSessionId: "agent-session-1"
    };
  }
}

class FailingPiClient extends PiAgentClient {
  override async run(): Promise<PiRunResult> {
    throw new Error("model failed");
  }
}

class StreamFlagPiClient extends PiAgentClient {
  readonly partialFlags: boolean[] = [];

  override async run(params: PiRunParams): Promise<PiRunResult> {
    this.partialFlags.push(params.includePartialMessages === true);
    await params.onEvent?.({ type: "assistant", content: "ok", agentSessionId: "stream-session" });
    await params.onEvent?.({ type: "result", content: "ok", agentSessionId: "stream-session" });
    return {
      text: "ok",
      toolMessages: [],
      agentSessionId: "stream-session"
    };
  }
}

function createEnv(): AppEnv {
  const root = mkdtempSync(join(tmpdir(), "pi-agent-env-test-"));
  return {
    host: "127.0.0.1",
    port: 8787,
    dataDir: join(root, "data"),
    workspaceDir: join(root, "workspace"),
    runtimeDir: join(root, "runtime"),
    providerId: "local-codex",
    model: "gpt-test",
    api: "openai-responses",
    apiKey: "test-key",
    baseUrl: "http://127.0.0.1:8080/v1",
    tools: ["read", "bash", "send_image", "send_file"],
    feishu: {
      enabled: false,
      appId: "",
      appSecret: ""
    },
    wechat: {
      enabled: false,
      appId: "default"
    }
  };
}
