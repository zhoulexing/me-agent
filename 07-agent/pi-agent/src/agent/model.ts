import type { ChannelId } from "../channels/types.js";

export type AgentRunSource = "user" | "scheduled" | "background";

export type AgentRunParams = {
  channelId: ChannelId;
  appId: string;
  groupId: string;
  threadId?: string;
  senderId?: string;
  senderName?: string;
  replyTo?: string;
  content: string;
  isPrivate: boolean;
  source: AgentRunSource;
};

export type AgentStreamEvent =
  | { type: "metadata"; sessionKey: string; agentSessionId?: string }
  | { type: "assistant"; content: string }
  | { type: "tool"; content: string }
  | { type: "error"; content: string }
  | { type: "done" };

export type AgentRunResult = {
  sessionKey: string;
  agentSessionId?: string;
  text: string;
  toolMessages: string[];
  status: "success" | "error";
  elapsedMs: number;
  error?: string;
};

export type AgentOnMessage = {
  type: "message";
  content: string;
  agentSessionId?: string;
};

export type AgentOnTool = {
  type: "tool";
  content: string;
  agentSessionId?: string;
};

export type AgentOnImage = {
  type: "image";
  filePath: string;
  fileName?: string;
};

export type AgentOnFile = {
  type: "file";
  filePath: string;
  fileName?: string;
};

export type AgentOnFinish = {
  type: "finish";
  result: AgentRunResult;
};

export type AgentOnError = {
  type: "error";
  error: string;
};

export type AgentOnEvent =
  | { type: "metadata"; sessionKey: string; agentSessionId?: string }
  | { type: "message"; content: string; agentSessionId?: string }
  | { type: "tool"; content: string; agentSessionId?: string }
  | { type: "image"; filePath: string; fileName?: string }
  | { type: "file"; filePath: string; fileName?: string }
  | { type: "result"; content: string; agentSessionId?: string }
  | { type: "error"; error: string }
  | { type: "finish"; result: AgentRunResult };

export type AgentRunCallbacks = {
  stream?: boolean;
  onMessage?: (event: AgentOnMessage) => void | Promise<void>;
  onTool?: (event: AgentOnTool) => void | Promise<void>;
  onImage?: (event: AgentOnImage) => void | Promise<void>;
  onFile?: (event: AgentOnFile) => void | Promise<void>;
  onFinish?: (event: AgentOnFinish) => void | Promise<void>;
  onError?: (event: AgentOnError) => void | Promise<void>;
  onEvent?: (event: AgentOnEvent) => void | Promise<void>;
};
