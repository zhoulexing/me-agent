import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AppEnv } from "../config/index.js";
import type { ClaudeRunParams } from "./client.js";
import { createCcAgentMcpServer } from "./mcps/index.js";
import { buildSystemPrompt } from "./prompt-builder.js";

export function buildClientOptions(params: ClaudeRunParams): Options {
  const cwd = sessionWorkspacePath(params.config.workspaceDir, params.sessionKey);

  return {
    model: params.config.model,
    cwd,
    resume: params.agentSessionId || undefined,
    systemPrompt: buildSystemPrompt({ cwd }),
    env: buildSdkEnv(params, cwd),
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    settingSources: ["user", "project"],
    skills: "all",
    maxTurns: 120,
    thinking: { type: "disabled" },
    includePartialMessages: params.includePartialMessages === true,
    mcpServers: {
      cc_agent: createCcAgentMcpServer({
        cwd,
        message: params.message,
        callbacks: params.callbacks
      })
    }
  };
}

function buildSdkEnv(params: ClaudeRunParams, workspacePath: string): Record<string, string | undefined> {
  const headers = buildCustomHeaders(params.config, params.sessionKey);

  return {
    ...process.env,
    ENABLE_TOOL_SEARCH: "off",
    CLAUDE_CODE_DISABLE_WORKFLOWS: "1",
    CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
    CLAUDE_AGENT_SDK_CLIENT_APP: "cc-agent/0.1.0",
    CLAUDE_CONFIG_DIR: params.config.claudeConfigDir,
    CLAUDE_CODE_MAX_CONTEXT_TOKENS: params.config.maxContextTokens,
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: params.config.compactThresholdTokens,
    YOUZAN_AGENT_SESSION_KEY: params.sessionKey,
    YOUZAN_AGENT_SESSION_WORKSPACE: workspacePath,
    YOUZAN_AGENT_THREAD_ID: params.threadId || undefined,
    ANTHROPIC_BASE_URL: params.config.anthropicBaseUrl,
    ANTHROPIC_AUTH_TOKEN: params.config.anthropicAuthToken,
    ANTHROPIC_API_KEY: params.config.anthropicApiKey,
    ANTHROPIC_MODEL: params.config.model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: params.config.model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: params.config.model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: params.config.model,
    ANTHROPIC_REASONING_MODEL: params.config.model,
    ANTHROPIC_CUSTOM_HEADERS: headers || undefined
  };
}

function buildCustomHeaders(config: AppEnv, sessionKey: string): string {
  const headers = [`Claw-Session-Key: ${sessionKey}`];
  if (config.serviceChainName) {
    headers.push(`X-Service-Chain: ${JSON.stringify({ name: config.serviceChainName })}`);
  }
  return headers.join("\n");
}

function sessionWorkspacePath(workspaceDir: string, sessionKey: string): string {
  const path = join(workspaceDir, encodeURIComponent(sessionKey));
  mkdirSync(path, { recursive: true });
  return path;
}
