import type { AgentRunParams } from "./model.js";
import { ChannelId } from "../channels/types.js";

export type SessionKeyParts = Pick<AgentRunParams, "channelId" | "appId" | "groupId">;

export function buildSessionKey(parts: SessionKeyParts): string {
  return [
    parts.channelId,
    encodeURIComponent(parts.appId),
    encodeURIComponent(parts.groupId)
  ].join(":");
}

export function parseSessionKey(sessionKey: string): SessionKeyParts {
  const parts = sessionKey.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid session_key: ${sessionKey}`);
  }

  const [channelId, encodedAppId, encodedGroupId] = parts;
  if (!isChannelId(channelId) || !encodedAppId || !encodedGroupId) {
    throw new Error(`Invalid session_key: ${sessionKey}`);
  }

  return {
    channelId,
    appId: decodeURIComponent(encodedAppId),
    groupId: decodeURIComponent(encodedGroupId)
  };
}

export function normalizeThreadId(threadId?: string): string {
  return threadId?.trim() || "";
}

export function buildQueueKey(message: SessionKeyParts & { threadId?: string }): string {
  const sessionKey = buildSessionKey(message);
  const threadId = normalizeThreadId(message.threadId);
  return threadId ? `${sessionKey}:${encodeURIComponent(threadId)}` : sessionKey;
}

function isChannelId(value: string): value is ChannelId {
  return value === ChannelId.Feishu || value === ChannelId.Wechat;
}
