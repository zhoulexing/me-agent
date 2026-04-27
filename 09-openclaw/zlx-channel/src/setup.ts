import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import { DEFAULT_ACCOUNT_ID } from "./accounts.js";
import type { CoreConfig, ZlxChannelConfig } from "./types.js";

function normalizeAccountMap(
  accounts: ZlxChannelConfig["accounts"],
): Record<string, Record<string, unknown>> {
  if (!accounts) return {};
  if (Array.isArray(accounts)) {
    return Object.fromEntries(
      accounts.map((account, index) => {
        const id = typeof account.id === "string" && account.id.trim() ? account.id.trim() : String(index);
        return [id, account as Record<string, unknown>];
      }),
    );
  }
  return { ...(accounts as Record<string, Record<string, unknown>>) };
}

export function applyZlxSetup(params: {
  cfg: OpenClawConfig;
  accountId: string;
  input: Record<string, unknown>;
}): OpenClawConfig {
  const nextCfg = structuredClone(params.cfg) as CoreConfig;
  const section = nextCfg.channels?.["zlx"] ?? {};
  const accounts = normalizeAccountMap(section.accounts);
  const target =
    params.accountId === DEFAULT_ACCOUNT_ID
      ? ({ ...section, accounts: undefined } as Record<string, unknown>)
      : { ...(accounts[params.accountId] ?? {}) };

  if (typeof params.input.name === "string") {
    target.name = params.input.name;
  }
  if (typeof params.input.outboundUrl === "string") {
    target.outboundUrl = params.input.outboundUrl;
  }
  if (typeof params.input.enabled === "boolean") {
    target.enabled = params.input.enabled;
  }
  if (typeof params.input.webhookPath === "string") {
    target.webhookPath = params.input.webhookPath;
  }
  if (typeof params.input.webhookSecret === "string") {
    target.webhookSecret = params.input.webhookSecret;
  }

  nextCfg.channels ??= {};
  if (params.accountId === DEFAULT_ACCOUNT_ID) {
    nextCfg.channels["zlx"] = {
      ...section,
      ...target,
    };
  } else {
    accounts[params.accountId] = target;
    nextCfg.channels["zlx"] = {
      ...section,
      accounts,
    };
  }
  return nextCfg as OpenClawConfig;
}

export function describeZlxAccountSetup(_accountId: string): {
  fields: Array<{ name: string; label: string; type: string; required: boolean; description?: string }>;
} {
  return {
    fields: [
      { name: "name", label: "Account Name", type: "string", required: false },
      { name: "outboundUrl", label: "Outbound URL", type: "string", required: true, description: "The URL to send outbound messages to" },
      { name: "webhookSecret", label: "Webhook Secret", type: "string", required: false },
      { name: "enabled", label: "Enabled", type: "boolean", required: false },
    ],
  };
}
