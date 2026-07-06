import type { AgentRuntime } from "../../agent/runtime.js";
import { ChannelId, type ChannelRuntime, type ChannelStatus } from "../types.js";
import type { FeishuClient } from "./client.js";
import type { FeishuConfig } from "./config.js";
import { toAgentRunParams } from "./message.js";
import { replyWithStreamingCard } from "./streaming-card-reply.js";

export class FeishuRuntime implements ChannelRuntime {
  constructor(
    private readonly config: FeishuConfig,
    private readonly client: FeishuClient,
    private readonly agent: AgentRuntime
  ) {}

  async start(): Promise<void> {
    if (!this.config.enabled) return;

    await this.client.startWebSocket(async (event, receipt) => {
      const message = toAgentRunParams(event, this.config);
      if (!message) return;
      await replyWithStreamingCard(this.client, this.agent, message, event.messageId, receipt.getReactionId);
    });
  }

  async stop(): Promise<void> {
    this.client.stopWebSocket();
  }

  async status(): Promise<ChannelStatus> {
    return {
      channelId: ChannelId.Feishu,
      enabled: this.config.enabled
    };
  }
}
