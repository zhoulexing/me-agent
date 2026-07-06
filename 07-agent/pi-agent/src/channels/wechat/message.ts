import { ChannelId, type AgentRunParams } from "../types.js";
import type { WechatConfig } from "./config.js";

export type WechatBridgeMessage = {
  groupId?: string;
  threadId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  text?: string;
  isPrivate?: boolean;
};

export type WechatSendTarget = {
  groupId: string;
  threadId?: string;
  replyTo?: string;
};

export type ResolveSendTargetOptions = {
  reply?: boolean;
};

export function toAgentRunParams(input: WechatBridgeMessage, config: WechatConfig): AgentRunParams | null {
  if (!input.groupId) return null;
  if (!input.text?.trim()) return null;

  return {
    channelId: ChannelId.Wechat,
    appId: config.appId,
    groupId: input.groupId,
    threadId: input.threadId,
    senderId: input.senderId,
    senderName: input.senderName,
    replyTo: input.messageId,
    content: input.text,
    isPrivate: input.isPrivate ?? false,
    source: "user"
  };
}

export function resolveSendTarget(message: AgentRunParams, options: ResolveSendTargetOptions = {}): WechatSendTarget {
  return {
    groupId: message.groupId,
    threadId: message.threadId,
    replyTo: options.reply === false ? undefined : message.replyTo
  };
}
