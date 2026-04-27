import {
  buildChannelOutboundSessionRoute,
  buildThreadAwareOutboundSessionRoute,
  createChatChannelPlugin,
} from "openclaw/plugin-sdk/channel-core";
import { waitUntilAbort } from "openclaw/plugin-sdk/channel-lifecycle";
import { getChatChannelMeta } from "openclaw/plugin-sdk/channel-plugin-common";
import type { ChannelMessageActionAdapter, ChannelMessageActionDiscoveryContext, ChannelToolSend } from "openclaw/plugin-sdk/channel-contract";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/channel-actions";
import { registerPluginHttpRoute } from "openclaw/plugin-sdk/webhook-ingress";
import { zlxChannelPluginConfigSchema } from "./config-schema.js";
import { listZlxChannelAccountIds, resolveDefaultZlxChannelAccountId, resolveZlxChannelAccount } from "./accounts.js";
import { CHANNEL_ID } from "./types.js";
import type { CoreConfig, ResolvedZlxChannelAccount } from "./types.js";
import { sendZlxChannelText } from "./outbound.js";
import { applyZlxSetup } from "./setup.js";
import { createZlxHttpHandler } from "./http-handler.js";

const meta = {
  ...getChatChannelMeta(CHANNEL_ID),
  id: CHANNEL_ID,
  label: "Zlx",
  selectionLabel: "Zlx (Webhook)",
  detailLabel: "Zlx webhook channel",
  docsPath: "/channels/zlx",
  docsLabel: "zlx",
  blurb: "Webhook channel for external ZLX systems.",
  order: 95,
};

const zlxChannelMessageActions: ChannelMessageActionAdapter = {
  describeMessageTool: (_params: ChannelMessageActionDiscoveryContext) => {
    return {
      actions: ["send"],
      capabilities: [],
      schema: { properties: { to: { type: "string" }, text: { type: "string" } } },
    };
  },
  extractToolSend: ({ args }: { args: Record<string, unknown> }): ChannelToolSend | null => {
    const to = typeof args.to === "string" ? args.to.trim() : "";
    return to ? { to, threadId: undefined } : null;
  },
  handleAction: async ({ action, cfg, accountId, params }) => {
    if (action === "send") {
      const to = readStringParam(params, "to") ?? "";
      const text = readStringParam(params, "text") ?? "";
      if (!to || !text) return jsonResult({ ok: false, error: "missing to or text" });
      const result = await sendZlxChannelText({ cfg: cfg as CoreConfig, accountId, to, text });
      return jsonResult({ ok: true, messageId: result.messageId });
    }
    throw new Error(`zlx-channel action not implemented: ${action}`);
  },
};

const zlxChannelStatus = {
  buildAccountSnapshot: (params: { account: ResolvedZlxChannelAccount }) => ({
    accountId: params.account.accountId,
    name: params.account.name,
    enabled: params.account.enabled,
    configured: params.account.configured,
  }),
};

export const zlxChannelPlugin = createChatChannelPlugin({
  base: {
    id: CHANNEL_ID,
    meta,
    capabilities: { chatTypes: ["direct", "group"] },
    configSchema: zlxChannelPluginConfigSchema as Parameters<typeof createChatChannelPlugin>[0]["base"]["configSchema"],
    setup: {
      applyAccountConfig: ({ cfg, accountId, input }) =>
        applyZlxSetup({ cfg: cfg as CoreConfig, accountId, input: input as Record<string, unknown> }),
    },
    config: {
      listAccountIds: (cfg) => listZlxChannelAccountIds(cfg as CoreConfig),
      resolveAccount: (cfg, accountId) => resolveZlxChannelAccount({ cfg: cfg as CoreConfig, accountId }),
      defaultAccountId: (cfg) => resolveDefaultZlxChannelAccountId(cfg as CoreConfig),
      isConfigured: (account) => account.configured,
    },
    messaging: {
      normalizeTarget: (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("dm:") || trimmed.startsWith("channel:") || trimmed.startsWith("thread:")) {
          return trimmed;
        }
        return `dm:${trimmed}`;
      },
      parseExplicitTarget: ({ raw }: { raw: string }) => {
        const trimmed = raw.trim();
        if (trimmed.startsWith("dm:") || trimmed.startsWith("channel:") || trimmed.startsWith("thread:")) {
          const parts = trimmed.split(":");
          return { to: trimmed, threadId: undefined, chatType: parts[0] === "dm" ? "direct" : "group" };
        }
        return { to: `dm:${trimmed}`, threadId: undefined, chatType: "direct" as const };
      },
      inferTargetChatType: ({ to }: { to: string }) => (to.startsWith("dm:") ? "direct" : "group"),
      resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target, replyToId, threadId, currentSessionKey }) => {
        const chatType = target.startsWith("dm:") ? "direct" : "group";
        const baseRoute = buildChannelOutboundSessionRoute({
          cfg,
          agentId,
          channel: CHANNEL_ID,
          accountId,
          peer: { kind: chatType, id: target },
          chatType,
          from: `zlx:${accountId ?? "default"}`,
          to: target,
        });
        return buildThreadAwareOutboundSessionRoute({
          route: baseRoute,
          replyToId,
          threadId,
          currentSessionKey,
          canRecoverCurrentThread: () => true,
        });
      },
    },
    status: zlxChannelStatus,
    gateway: {
      startAccount: async (ctx) => {
        const account = ctx.account;
        if (!account.configured) {
          throw new Error(`zlx-channel is not configured for account "${account.accountId}"`);
        }
        const webhookPath =
          typeof account.config.webhookPath === "string" && account.config.webhookPath.trim()
            ? account.config.webhookPath.trim()
            : "/zlx-webhook";
        const unregister = registerPluginHttpRoute({
          path: webhookPath,
          auth: "plugin",
          pluginId: CHANNEL_ID,
          accountId: account.accountId,
          replaceExisting: true,
          log: (message) => ctx.log?.info?.(message),
          handler: createZlxHttpHandler({ cfg: ctx.cfg as CoreConfig }),
        });
        ctx.setStatus({
          accountId: account.accountId,
          running: true,
          configured: true,
          enabled: account.enabled,
          webhookPath,
        });
        return waitUntilAbort(ctx.abortSignal, () => {
          unregister();
          ctx.setStatus({
            accountId: account.accountId,
            running: false,
            configured: true,
            enabled: account.enabled,
            webhookPath,
          });
        });
      },
    },
    actions: zlxChannelMessageActions,
  },
  outbound: {
    base: { deliveryMode: "direct" },
    attachedResults: {
      channel: CHANNEL_ID,
      sendText: async ({ cfg, to, text, accountId, threadId, replyToId }) =>
        await sendZlxChannelText({ cfg: cfg as CoreConfig, accountId, to, text, threadId, replyToId }),
    },
  },
});
