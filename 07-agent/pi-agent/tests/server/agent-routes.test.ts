import { describe, expect, it } from "vitest";
import type { AgentRunCallbacks, AgentRunParams, AgentRunResult } from "../../src/agent/model.js";
import { ChannelId } from "../../src/channels/types.js";
import { createAgentRoutes } from "../../src/server/routes/agent.js";

describe("agent routes", () => {
  it("runs non-streaming messages with default local WeChat identity", async () => {
    const agent = new RouteFakeAgent();
    const app = createAgentRoutes({ agent: agent as never } as never);

    const response = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({ content: "你好" }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sessionKey: "wechat:local:local",
      text: "route reply",
      status: "success"
    });
    expect(agent.messages).toEqual([
      {
        channelId: ChannelId.Wechat,
        appId: "local",
        groupId: "local",
        content: "你好",
        isPrivate: true,
        source: "user"
      }
    ]);
  });

  it("streams agent callback events as SSE", async () => {
    const agent = new RouteFakeAgent();
    const app = createAgentRoutes({ agent: agent as never } as never);

    const response = await app.request("/messages/stream", {
      method: "POST",
      body: JSON.stringify({ channelId: "feishu", appId: "cli", groupId: "chat", content: "stream" }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("event: message");
    expect(text).toContain('"content":"stream reply"');
    expect(text).toContain("event: finish");
    expect(agent.lastMethod).toBe("runStream");
    expect(agent.lastCallbacks?.stream).toBe(true);
  });
});

class RouteFakeAgent {
  readonly messages: AgentRunParams[] = [];
  lastCallbacks?: AgentRunCallbacks;
  lastMethod = "";

  async run(params: AgentRunParams, callbacks: AgentRunCallbacks = {}): Promise<AgentRunResult> {
    this.lastMethod = "run";
    return this.handleRun(params, { ...callbacks, stream: false });
  }

  async runStream(params: AgentRunParams, callbacks: AgentRunCallbacks = {}): Promise<AgentRunResult> {
    this.lastMethod = "runStream";
    return this.handleRun(params, { ...callbacks, stream: true });
  }

  private async handleRun(params: AgentRunParams, callbacks: AgentRunCallbacks): Promise<AgentRunResult> {
    this.messages.push(params);
    this.lastCallbacks = callbacks;
    const result: AgentRunResult = {
      sessionKey: `${params.channelId}:${params.appId}:${params.groupId}`,
      agentSessionId: "agent-session-route",
      text: callbacks.stream ? "stream reply" : "route reply",
      toolMessages: [],
      status: "success",
      elapsedMs: 1
    };

    await callbacks.onEvent?.({ type: "message", content: result.text, agentSessionId: result.agentSessionId });
    await callbacks.onFinish?.({ type: "finish", result });
    await callbacks.onEvent?.({ type: "finish", result });
    return result;
  }
}
