export const DEFAULT_ACCOUNT_ID = "default";

type ZlxAccounts = Record<string, unknown> | Array<{ id?: unknown }>;

function normalizeAccounts(accounts: ZlxAccounts | undefined): Record<string, Record<string, unknown>> {
  if (!accounts) return {};
  if (Array.isArray(accounts)) {
    return Object.fromEntries(
      accounts.map((account, index) => {
        const id = typeof account.id === "string" && account.id.trim() ? account.id.trim() : String(index);
        return [id, account as Record<string, unknown>];
      }),
    );
  }
  return accounts as Record<string, Record<string, unknown>>;
}

export function listZlxChannelAccountIds(cfg: { channels?: { zlx?: { accounts?: ZlxAccounts } } }): string[] {
  const channelCfg = cfg.channels?.zlx;
  if (!channelCfg) return [];
  const accounts = normalizeAccounts(channelCfg.accounts);
  if (Object.keys(accounts).length > 0) {
    return Object.keys(accounts);
  }
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultZlxChannelAccountId(cfg: { channels?: { zlx?: { defaultAccount?: string } } }): string {
  const channelCfg = cfg.channels?.zlx;
  return channelCfg?.defaultAccount ?? DEFAULT_ACCOUNT_ID;
}

export function resolveZlxChannelAccount(params: {
  cfg: { channels?: { zlx?: Record<string, unknown> } };
  accountId?: string | null;
}) {
  const { cfg, accountId } = params;
  const resolvedId = accountId ?? resolveDefaultZlxChannelAccountId(cfg);
  const channelCfg = cfg.channels?.zlx ?? {};
  const accounts = normalizeAccounts(channelCfg.accounts as ZlxAccounts | undefined);

  const mergedConfig: Record<string, unknown> = {
    ...channelCfg,
    accounts: undefined,
    ...(accounts[resolvedId] ?? {}),
  };

  return {
    accountId: resolvedId,
    enabled: (mergedConfig.enabled as boolean) ?? true,
    configured: Boolean(mergedConfig.outboundUrl),
    name: mergedConfig.name as string | undefined,
    outboundUrl: (mergedConfig.outboundUrl as string) ?? "",
    config: mergedConfig,
  };
}
