import type { AgentRunParams } from "../types.js";
import type { FeishuConfig } from "./config.js";
import type { FeishuClient } from "./client.js";
import { toAgentRunParams } from "./message.js";

export async function normalizeInbound(input: unknown, client: FeishuClient, config: FeishuConfig): Promise<AgentRunParams | null> {
  const event = await client.receive(input);
  if (!event) return null;
  return toAgentRunParams(event, config);
}
