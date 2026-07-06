import { createSendFileTool, createSendImageTool, type AgentToolContext } from "../tools/index.js";

export function createPiAgentTools(context: AgentToolContext) {
  return [createSendImageTool(context), createSendFileTool(context)];
}
