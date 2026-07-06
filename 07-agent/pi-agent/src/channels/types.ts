export type { AgentRunParams } from "../agent/model.js";

export enum ChannelId {
  Feishu = "feishu",
  Wechat = "wechat"
}

export type ChannelStatus = {
  channelId: ChannelId;
  enabled: boolean;
};

export type ChannelRuntime = {
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<ChannelStatus>;
};
