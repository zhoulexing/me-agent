import type { CoreConfig } from "./types.js";
import { resolveZlxChannelAccount } from "./accounts.js";

export async function sendZlxChannelText(params: {
  cfg: CoreConfig;
  accountId?: string | null;
  to: string;
  text: string;
  threadId?: string | number | null;
  replyToId?: string | number | null;
}): Promise<{ to: string; messageId: string }> {
  const account = resolveZlxChannelAccount({ cfg: params.cfg, accountId: params.accountId });
  const { outboundUrl } = account;

  if (!outboundUrl) {
    throw new Error("zlx-channel outboundUrl is not configured");
  }

  const payload = {
    id: `msg-${Date.now()}`,
    text: params.text,
    target: params.to,
    threadId: params.threadId != null ? String(params.threadId) : undefined,
    replyToId: params.replyToId != null ? String(params.replyToId) : undefined,
    senderId: account.config.name ?? "openclaw",
    senderName: "OpenClaw Bot",
  };

  const response = await fetch(outboundUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`zlx-channel outbound failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { messageId?: string };
  return { to: params.to, messageId: result.messageId ?? "" };
}