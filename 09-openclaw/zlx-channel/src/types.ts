export const CHANNEL_ID = "zlx" as const;

export type ZlxChannelAccountConfig = {
  name?: string;
  enabled?: boolean;
  outboundUrl?: string;
  allowFrom?: Array<string | number>;
  defaultTo?: string;
};

export type ZlxChannelConfig = ZlxChannelAccountConfig & {
  webhookPath?: string;
  webhookSecret?: string;
  accounts?: Record<string, Partial<ZlxChannelAccountConfig>> | Array<Partial<ZlxChannelAccountConfig> & { id?: string }>;
  defaultAccount?: string;
};

export type CoreConfig = {
  channels?: {
    zlx?: ZlxChannelConfig;
  };
  session?: {
    store?: string;
  };
};

export type ResolvedZlxChannelAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  outboundUrl: string;
  config: ZlxChannelAccountConfig;
};

export type ZlxBusMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  conversation: {
    id: string;
    kind: "direct" | "channel";
    title?: string;
  };
  timestamp: number;
  threadId?: string;
  replyToId?: string;
  attachments?: ZlxAttachment[];
};

export type ZlxAttachment = {
  url?: string;
  mimeType?: string;
  filename?: string;
  data?: string; // base64 encoded
};

export type ZlxInboundPayload = {
  message: ZlxBusMessage;
};
