import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { createSendFileTool, createSendImageTool, type AgentToolContext } from "../tools/index.js";

export function createCcAgentMcpServer(context: AgentToolContext) {
  return createSdkMcpServer({
    name: "cc_agent",
    version: "0.1.0",
    alwaysLoad: true,
    tools: [createSendImageTool(context), createSendFileTool(context)]
  });
}
