import { describe, expect, it } from "vitest";
import type { AgentRunCallbacks, AgentRunParams, AgentRunResult } from "../../src/agent/model.js";
import { ChannelId } from "../../src/channels/types.js";
import { FeishuRuntime } from "../../src/channels/feishu/runtime.js";
import type { FeishuReceivedMessage } from "../../src/channels/feishu/message.js";

describe("FeishuRuntime", () => {
  it("routes websocket messages through streaming card reply", async () => {
    const client = new RuntimeFeishuClient();
    const agent = new RuntimeAgent();
    const runtime = new FeishuRuntime(
      {
        enabled: true,
        appId: "cli-test",
        appSecret: "secret"
      },
      client as never,
      agent as never
    );

    await runtime.start();
    await client.emit({
      messageId: "om_1",
      chatId: "oc_1",
      chatType: "group",
      senderId: "ou_1",
      senderName: "User",
      threadId: "thread-1",
      text: "你好"
    });

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
    expect(client.calls).toContain("startWebSocket");
    expect(client.calls).toContain("deleteReaction:om_1:reaction-1");
    expect(client.calls).toContain("createCardInstance");
    expect(client.calls).toContain("sendCardReference:card-1");
    expect(client.calls).toContain("finishStreamingCard:card-1");
    expect(client.calls.some((call) => call.startsWith("updateCardElementContent:streaming_content:"))).toBe(true);
    expect(client.calls.some((call) => call.startsWith("updateCardInstance:card-1"))).toBe(true);
  });

  it("does not start websocket when disabled", async () => {
    const client = new RuntimeFeishuClient();
    const runtime = new FeishuRuntime(
      {
        enabled: false,
        appId: "cli-test",
        appSecret: "secret"
      },
      client as never,
      new RuntimeAgent() as never
    );

    await runtime.start();

    expect(client.calls).toEqual([]);
    expect(await runtime.status()).toEqual({ channelId: ChannelId.Feishu, enabled: false });
  });
});

class RuntimeAgent {
  readonly messages: AgentRunParams[] = [];

  async run(params: AgentRunParams, callbacks: AgentRunCallbacks = {}): Promise<AgentRunResult> {
    this.messages.push(params);
    await callbacks.onTool?.({ type: "tool", content: "执行命令 (command=ls)", agentSessionId: "agent-session-1" });
    await callbacks.onMessage?.({ type: "message", content: "agent reply", agentSessionId: "agent-session-1" });
    return {
      sessionKey: `${params.channelId}:${params.appId}:${params.groupId}`,
      agentSessionId: "agent-session-1",
      text: "agent reply",
      toolMessages: ["执行命令 (command=ls)"],
      status: "success",
      elapsedMs: 10
    };
  }
}

class RuntimeFeishuClient {
  readonly calls: string[] = [];
  private onMessage?: (message: FeishuReceivedMessage, receipt: { getReactionId?: string }) => Promise<void>;

  async startWebSocket(onMessage: (message: FeishuReceivedMessage, receipt: { getReactionId?: string }) => Promise<void>): Promise<void> {
    this.calls.push("startWebSocket");
    this.onMessage = onMessage;
  }

  stopWebSocket(): void {
    this.calls.push("stopWebSocket");
  }

  async emit(message: FeishuReceivedMessage): Promise<void> {
    if (!this.onMessage) throw new Error("websocket not started");
    await this.onMessage(message, { getReactionId: "reaction-1" });
  }

  async deleteReaction(messageId?: string, reactionId?: string): Promise<void> {
    this.calls.push(`deleteReaction:${messageId}:${reactionId}`);
  }

  async createCardInstance(): Promise<string> {
    this.calls.push("createCardInstance");
    return "card-1";
  }

  async sendCardReference(_target: unknown, cardId: string): Promise<string> {
    this.calls.push(`sendCardReference:${cardId}`);
    return "reply-message-1";
  }

  async updateCardInstance(cardId: string): Promise<void> {
    this.calls.push(`updateCardInstance:${cardId}`);
  }

  async updateCardElementContent(_cardId: string, elementId: string, content: string): Promise<void> {
    this.calls.push(`updateCardElementContent:${elementId}:${content}`);
  }

  async finishStreamingCard(cardId: string): Promise<void> {
    this.calls.push(`finishStreamingCard:${cardId}`);
  }

  async sendCard(): Promise<string> {
    this.calls.push("sendCard");
    return "static-message-1";
  }
}
