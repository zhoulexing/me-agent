import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/agent/runtime.js";
import { PiAgentClient, type PiRunParams, type PiRunResult } from "../../src/agent/client.js";
import { ChannelId } from "../../src/channels/types.js";
import type { AppEnv } from "../../src/config/index.js";
import { createRepositories } from "../../src/db/index.js";
import { createAgentDataRoutes } from "../../src/server/routes/agent-data.js";

describe("agent-data routes", () => {
  it("queries sessions, messages, runs, run events, and sdk events by agent_session_id", async () => {
    const repositories = createRepositories(mkdtempSync(join(tmpdir(), "pi-agent-data-route-test-")));
    const runtime = new AgentRuntime({
      config: createEnv(),
      repositories,
      client: new DataRoutePiClient()
    });
    const app = createAgentDataRoutes({ repositories } as never);

    try {
      await runtime.run({
        channelId: ChannelId.Wechat,
        appId: "local",
        groupId: "group-1",
        content: "查询数据",
        isPrivate: true,
        source: "user"
      });

      const sessions = await json(app, "/sessions?limit=20");
      expect(sessions.data).toHaveLength(1);
      expect(sessions.data[0]).toMatchObject({
        session_key: "wechat:local:group-1",
        agent_session_id: "agent-session-data"
      });

      const session = await json(app, "/sessions/agent-session-data");
      expect(session.data).toMatchObject({ agent_session_id: "agent-session-data" });

      const messages = await json(app, "/sessions/agent-session-data/messages");
      expect(messages.data.map((message: { direction: string; content: string }) => [message.direction, message.content])).toEqual([
        ["outbound", "数据回复"],
        ["inbound", "查询数据"]
      ]);

      const runs = await json(app, "/sessions/agent-session-data/runs");
      expect(runs.data).toHaveLength(1);
      expect(runs.data[0]).toMatchObject({
        status: "finished",
        input_content: "查询数据"
      });

      const runId = runs.data[0].id;
      const runDetail = await json(app, `/runs/${runId}`);
      expect(runDetail.data.events.map((event: { event_type: string }) => event.event_type)).toEqual(["tool_message", "assistant_text"]);
      expect(runDetail.data.sdkEvents.map((event: { event_name: string }) => event.event_name)).toEqual(["tool", "assistant", "result"]);

      const sdkEvents = await json(app, `/sdk-events?eventName=assistant&runId=${runId}`);
      expect(sdkEvents.data).toHaveLength(1);
      expect(sdkEvents.data[0]).toMatchObject({ event_name: "assistant", level: "info" });
    } finally {
      repositories.db.close();
    }
  });
});

class DataRoutePiClient extends PiAgentClient {
  override async run(params: PiRunParams): Promise<PiRunResult> {
    await params.onEvent?.({ type: "tool", content: "执行命令 (command=pwd)", agentSessionId: "agent-session-data" });
    await params.onEvent?.({ type: "assistant", content: "数据回复", agentSessionId: "agent-session-data" });
    await params.onEvent?.({ type: "result", content: "数据回复", agentSessionId: "agent-session-data" });
    return {
      text: "数据回复",
      toolMessages: ["执行命令 (command=pwd)"],
      agentSessionId: "agent-session-data"
    };
  }
}

async function json(app: ReturnType<typeof createAgentDataRoutes>, path: string) {
  const response = await app.request(path);
  expect(response.status).toBe(200);
  return response.json();
}

function createEnv(): AppEnv {
  const root = mkdtempSync(join(tmpdir(), "pi-agent-data-route-env-"));
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
