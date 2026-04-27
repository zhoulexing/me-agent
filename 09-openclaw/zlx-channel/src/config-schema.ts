import { z } from "zod";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk/channel-config-schema";

const ZlxChannelAccountConfigSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  outboundUrl: z.string().url().optional(),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  defaultTo: z.string().optional(),
});

const ZlxChannelConfigSchema = ZlxChannelAccountConfigSchema.extend({
  webhookPath: z.string().optional(),
  webhookSecret: z.string().optional(),
  accounts: z.record(z.string(), ZlxChannelAccountConfigSchema.partial()).optional(),
  defaultAccount: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const zlxChannelPluginConfigSchema = buildChannelConfigSchema(ZlxChannelConfigSchema as any) as ReturnType<typeof buildChannelConfigSchema>;