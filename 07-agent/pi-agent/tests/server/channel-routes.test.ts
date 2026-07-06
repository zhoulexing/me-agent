import { describe, expect, it } from "vitest";
import type { AgentRunCallbacks, AgentRunParams, AgentRunResult } from "../../src/agent/model.js";
import { ChannelId } from "../../src/channels/types.js";
import { createChannelRoutes } from "../../src/server/routes/channels.js";

describe("channel routes", () => {
  it("returns Feishu URL verification challenge", async () => {
    const app = createChannelRoutes({
      agent: new FakeAgent() as never,
      repositories: {} as never,
      feishu: {
        config: { enabled: true, appId: "cli-test", appSecret: "secret" },
        client: new FakeFeishuClient() as never
      },
      wechat: {
        config: { enabled: false, appId: "wechat-app" },
        client: new FakeWechatClient() as never
      }
    });

    const response = await app.request("/feishu/events", {
      method: "POST",
      body: JSON.stringify({ challenge: "challenge-token" }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "challenge-token" });
  });

  it("routes Feishu inbound messages through agent callbacks to outbound client methods", async () => {
    const agent = new FakeAgent();
    const feishu = new FakeFeishuClient();
    const app = createChannelRoutes({
      agent: agent as never,
      repositories: {} as never,
      feishu: {
        config: { enabled: true, appId: "cli-test", appSecret: "secret" },
        client: feishu as never
      },
      wechat: {
        config: { enabled: false, appId: "wechat-app" },
        client: new FakeWechatClient() as never
      }
    });

    const response = await app.request("/feishu/events", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        messageId: "om_1",
        chatId: "oc_1",
        chatType: "group",
        senderId: "ou_1",
        senderName: "User",
        threadId: "thread-1",
        text: "你好"
      }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(agent.messages).toEqual([
      {
        channelId: ChannelId.Feishu,
        appId: "cli-test",
        groupId: "oc_1",
        threadId: "thread-1",
        senderId: "ou_1",
        senderName: "User",
        replyTo: "om_1",
        content: "你好",
        isPrivate: false,
        source: "user"
      }
    ]);
    expect(feishu.sent).toEqual([
      { type: "image", target: { receiveIdType: "chat_id", receiveId: "oc_1" }, filePath: "/tmp/a.png" },
      { type: "file", target: { receiveIdType: "chat_id", receiveId: "oc_1" }, filePath: "/tmp/a.txt", fileName: "a.txt" },
      {
        type: "text",
        target: { receiveIdType: "chat_id", receiveId: "oc_1", replyTo: "om_1", replyInThread: true },
        text: "agent reply"
      }
    ]);
  });

  it("does not route disabled Feishu channels", async () => {
    const app = createChannelRoutes({
      agent: new FakeAgent() as never,
      repositories: {} as never,
      feishu: {
        config: { enabled: false, appId: "cli-test", appSecret: "secret" },
        client: new FakeFeishuClient() as never
      },
      wechat: {
        config: { enabled: false, appId: "wechat-app" },
        client: new FakeWechatClient() as never
      }
    });

    const response = await app.request("/feishu/events", {
      method: "POST",
      body: JSON.stringify({ chatId: "oc_1", text: "ignored" }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "feishu disabled" });
  });

  it("routes WeChat inbound messages through agent callbacks to outbound client methods", async () => {
    const agent = new FakeAgent();
    const wechat = new FakeWechatClient();
    const app = createChannelRoutes({
      agent: agent as never,
      repositories: {} as never,
      feishu: {
        config: { enabled: false, appId: "", appSecret: "" },
        client: {} as never
      },
      wechat: {
        config: { enabled: true, appId: "wechat-app", bridgeBaseUrl: "memory://wechat" },
        client: wechat as never
      }
    });

    const response = await app.request("/wechat/events", {
      method: "POST",
      body: JSON.stringify({
        groupId: "group-1",
        threadId: "thread-1",
        messageId: "message-1",
        senderId: "user-1",
        senderName: "User",
        text: "你好",
        isPrivate: true
      }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(agent.messages).toEqual([
      {
        channelId: ChannelId.Wechat,
        appId: "wechat-app",
        groupId: "group-1",
        threadId: "thread-1",
        senderId: "user-1",
        senderName: "User",
        replyTo: "message-1",
        content: "你好",
        isPrivate: true,
        source: "user"
      }
    ]);
    expect(wechat.sent).toEqual([
      { type: "image", target: { groupId: "group-1", threadId: "thread-1" }, filePath: "/tmp/a.png" },
      { type: "file", target: { groupId: "group-1", threadId: "thread-1" }, filePath: "/tmp/a.txt", fileName: "a.txt" },
      { type: "text", target: { groupId: "group-1", threadId: "thread-1", replyTo: "message-1" }, text: "agent reply" }
    ]);
  });

  it("does not route disabled WeChat channels", async () => {
    const app = createChannelRoutes({
      agent: new FakeAgent() as never,
      repositories: {} as never,
      feishu: {
        config: { enabled: false, appId: "", appSecret: "" },
        client: {} as never
      },
      wechat: {
        config: { enabled: false, appId: "wechat-app" },
        client: new FakeWechatClient() as never
      }
    });

    const response = await app.request("/wechat/events", {
      method: "POST",
      body: JSON.stringify({ groupId: "group-1", text: "ignored" }),
      headers: { "content-type": "application/json" }
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "wechat disabled" });
  });
});

class FakeAgent {
  readonly messages: AgentRunParams[] = [];

  async run(params: AgentRunParams, callbacks: AgentRunCallbacks = {}): Promise<AgentRunResult> {
    this.messages.push(params);
    await callbacks.onImage?.({ type: "image", filePath: "/tmp/a.png", fileName: "a.png" });
    await callbacks.onFile?.({ type: "file", filePath: "/tmp/a.txt", fileName: "a.txt" });
    const result: AgentRunResult = {
      sessionKey: `${params.channelId}:${params.appId}:${params.groupId}`,
      text: "agent reply",
      toolMessages: [],
      status: "success",
      elapsedMs: 1
    };
    await callbacks.onFinish?.({ type: "finish", result });
    return result;
  }
}

class FakeWechatClient {
  readonly sent: Array<Record<string, unknown>> = [];

  async receive(input: unknown): Promise<unknown> {
    return input;
  }

  async sendText(target: unknown, text: string): Promise<void> {
    this.sent.push({ type: "text", target, text });
  }

  async sendImage(target: unknown, filePath: string): Promise<void> {
    this.sent.push({ type: "image", target, filePath });
  }

  async sendFile(target: unknown, filePath: string, fileName: string): Promise<void> {
    this.sent.push({ type: "file", target, filePath, fileName });
  }
}

class FakeFeishuClient {
  readonly sent: Array<Record<string, unknown>> = [];

  resolveChallenge(input: unknown): string | undefined {
    if (!input || typeof input !== "object") return undefined;
    const challenge = (input as { challenge?: unknown }).challenge;
    return typeof challenge === "string" ? challenge : undefined;
  }

  async receive(input: unknown): Promise<unknown> {
    return input;
  }

  async sendText(target: unknown, text: string): Promise<void> {
    this.sent.push({ type: "text", target, text });
  }

  async sendImage(target: unknown, filePath: string): Promise<void> {
    this.sent.push({ type: "image", target, filePath });
  }

  async sendFile(target: unknown, filePath: string, fileName: string): Promise<void> {
    this.sent.push({ type: "file", target, filePath, fileName });
  }
}
