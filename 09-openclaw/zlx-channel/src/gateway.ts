import type { ChannelGatewayContext } from "openclaw/plugin-sdk/channel-contract";
import type { ResolvedZlxChannelAccount } from "./types.js";

const CHANNEL_ID = "zlx";

export async function startZlxGatewayAccount(
  _channelId: string,
  _channelLabel: string,
  ctx: ChannelGatewayContext<ResolvedZlxChannelAccount>,
): Promise<void> {
  const account = ctx.account;
  if (!account.configured) {
    throw new Error(`zlx-channel is not configured for account "${account.accountId}"`);
  }

  ctx.setStatus({
    accountId: account.accountId,
    running: true,
    configured: true,
    enabled: account.enabled,
  });
}