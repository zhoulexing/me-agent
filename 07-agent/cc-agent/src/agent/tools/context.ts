import type { AgentRunCallbacks, AgentRunParams } from "../model.js";

export type AgentToolContext = {
  cwd: string;
  message?: AgentRunParams;
  callbacks?: AgentRunCallbacks;
};
