import type { ResolvedZlxChannelAccount } from "./types.js";

export function createZlxStatusAdapter() {
  return {
    buildAccountSnapshot: (account: ResolvedZlxChannelAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
    }),
  };
}