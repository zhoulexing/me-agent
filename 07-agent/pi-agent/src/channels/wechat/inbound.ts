import type { AgentRunParams } from "../types.js";
import type { WechatClient } from "./client.js";
import type { WechatConfig } from "./config.js";
import { toAgentRunParams } from "./message.js";

export async function normalizeInbound(input: unknown, client: WechatClient, config: WechatConfig): Promise<AgentRunParams | null> {
  const event = await client.receive(input);
  if (!event) return null;
  return toAgentRunParams(event, config);
}
