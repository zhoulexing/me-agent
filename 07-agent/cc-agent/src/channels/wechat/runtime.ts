import { ChannelId, type ChannelRuntime, type ChannelStatus } from "../types.js";
import type { WechatConfig } from "./config.js";

export class WechatRuntime implements ChannelRuntime {
  constructor(private readonly config: WechatConfig) {}

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async status(): Promise<ChannelStatus> {
    return {
      channelId: ChannelId.Wechat,
      enabled: this.config.enabled
    };
  }
}
