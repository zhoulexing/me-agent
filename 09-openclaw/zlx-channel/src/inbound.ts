import { dispatchInboundReplyWithBase } from "openclaw/plugin-sdk/inbound-reply-dispatch";
import { getZlxChannelRuntime } from "./runtime.js";
import type { CoreConfig, ZlxBusMessage } from "./types.js";
import type { PluginRuntime } from "openclaw/plugin-sdk/runtime-store";
import { buildChannelOutboundSessionRoute } from "openclaw/plugin-sdk/channel-core";
import { getChatChannelMeta } from "openclaw/plugin-sdk/channel-plugin-common";
import { sendZlxChannelText } from "./outbound.js";
import { resolveZlxChannelAccount } from "./accounts.js";

const CHANNEL_ID = "zlx";

function normalizeTarget(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("dm:") || trimmed.startsWith("channel:") || trimmed.startsWith("thread:")) {
    return trimmed;
  }
  return `dm:${trimmed}`;
}

export async function handleZlxInbound(params: {
  channelId: string;
  channelLabel: string;
  account: { accountId: string; config: Record<string, unknown> };
  config: CoreConfig;
  message: ZlxBusMessage;
}): Promise<void> {
  const runtime = getZlxChannelRuntime();
  const { message } = params;
  const inbound = message;

  const target = normalizeTarget(
    inbound.conversation.kind === "direct"
      ? `dm:${inbound.conversation.id}`
      : `channel:${inbound.conversation.id}`,
  );

  const route = runtime.channel.routing.resolveAgentRoute({
    cfg: params.config as Parameters<typeof runtime.channel.routing.resolveAgentRoute>[0]["cfg"],
    channel: params.channelId,
    accountId: params.account.accountId,
    peer: {
      kind: inbound.conversation.kind === "direct" ? "direct" : "channel",
      id: target,
    },
  });

  const storePath = runtime.channel.session.resolveStorePath(params.config.session?.store, {
    agentId: route.agentId,
  });
  const previousTimestamp = runtime.channel.session.readSessionUpdatedAt({ storePath, sessionKey: route.sessionKey });

  const body = runtime.channel.reply.formatAgentEnvelope({
    channel: params.channelLabel,
    from: inbound.senderName || inbound.senderId,
    timestamp: inbound.timestamp,
    previousTimestamp,
    envelope: runtime.channel.reply.resolveEnvelopeFormatOptions(params.config as Parameters<typeof runtime.channel.reply.resolveEnvelopeFormatOptions>[0]),
    body: inbound.text,
  });

  const mediaPayload = resolveInboundMediaPayload(inbound.attachments);

  const ctxPayload = runtime.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: inbound.text,
    RawBody: inbound.text,
    CommandBody: inbound.text,
    From: inbound.conversation.kind === "direct" ? `dm:${inbound.senderId}` : `channel:${inbound.senderId}`,
    To: target,
    SessionKey: route.sessionKey,
    AccountId: route.accountId ?? params.account.accountId,
    ChatType: inbound.conversation.kind === "direct" ? "direct" : "group",
    ConversationLabel: inbound.conversation.title || inbound.conversation.id,
    GroupSubject: inbound.conversation.kind === "channel" ? inbound.conversation.title : undefined,
    GroupChannel: inbound.conversation.kind === "channel" ? inbound.conversation.id : undefined,
    NativeChannelId: inbound.conversation.id,
    MessageThreadId: inbound.threadId,
    ThreadLabel: inbound.threadId,
    ThreadParentId: inbound.threadId ? inbound.conversation.id : undefined,
    SenderName: inbound.senderName,
    SenderId: inbound.senderId,
    Provider: params.channelId,
    Surface: params.channelId,
    MessageSid: inbound.id,
    MessageSidFull: inbound.id,
    ReplyToId: inbound.replyToId,
    Timestamp: inbound.timestamp,
    OriginatingChannel: params.channelId,
    OriginatingTo: target,
    CommandAuthorized: true,
    ...mediaPayload,
  });

  const resolvedAccount = resolveZlxChannelAccount({ cfg: params.config, accountId: params.account.accountId });

  await dispatchInboundReplyWithBase({
    cfg: params.config as Parameters<typeof dispatchInboundReplyWithBase>[0]["cfg"],
    channel: params.channelId,
    accountId: params.account.accountId,
    route,
    storePath,
    ctxPayload,
    core: runtime as Parameters<typeof dispatchInboundReplyWithBase>[0]["core"],
    deliver: async (payload) => {
      const text = payload && typeof payload === "object" && "text" in payload ? ((payload as { text?: string }).text ?? "") : "";
      if (!text.trim()) return;
      await sendZlxChannelText({
        cfg: params.config,
        accountId: params.account.accountId,
        to: target,
        text,
        threadId: inbound.threadId,
        replyToId: inbound.id,
      });
    },
    onRecordError: (error) => {
      throw error instanceof Error ? error : new Error(`zlx-channel session record failed: ${String(error)}`);
    },
    onDispatchError: (error) => {
      throw error instanceof Error ? error : new Error(`zlx-channel dispatch failed: ${String(error)}`);
    },
  });
}

function resolveInboundMediaPayload(attachments?: Array<{ url?: string; mimeType?: string; filename?: string; data?: string }>) {
  if (!attachments || attachments.length === 0) return {};
  const media: Array<{ url?: string; mimeType?: string; filename?: string; data?: string }> = [];
  for (const att of attachments) {
    if (att.url) {
      media.push({ url: att.url, mimeType: att.mimeType, filename: att.filename });
    } else if (att.data) {
      media.push({ url: undefined, mimeType: att.mimeType, filename: att.filename, data: att.data });
    }
  }
  return { Media: media };
}

export async function handleZlxHttpInbound(params: {
  body: string;
  cfg: CoreConfig;
}): Promise<{ status: number; body: string }> {
  const { body, cfg } = params;

  let parsed: { message: ZlxBusMessage } | null = null;
  try {
    const json = JSON.parse(body);
    if (json && typeof json === "object" && "message" in json) {
      parsed = json as { message: ZlxBusMessage };
    }
  } catch {
    // ignore
  }

  if (!parsed) {
    return { status: 400, body: JSON.stringify({ error: "invalid payload" }) };
  }

  const account = resolveZlxChannelAccount({ cfg, accountId: undefined });
  if (!account.configured) {
    return { status: 503, body: JSON.stringify({ error: "channel not configured" }) };
  }

  await handleZlxInbound({
    channelId: CHANNEL_ID,
    channelLabel: "Zlx",
    account: { accountId: account.accountId, config: account.config },
    config: cfg,
    message: parsed.message,
  });

  return { status: 200, body: JSON.stringify({ ok: true }) };
}