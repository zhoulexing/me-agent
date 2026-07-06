import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AuthStorage, DefaultResourceLoader, ModelRegistry, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { AppEnv } from "../config/index.js";
import { createPiAgentTools, type AgentToolContext } from "./mcps/index.js";
import { buildSystemPrompt } from "./prompt-builder.js";

export type PiSessionOptionsParams = {
  config: AppEnv;
  sessionKey: string;
  threadId: string;
  agentSessionId?: string | null;
  context: AgentToolContext;
};

export async function buildPiSessionOptions(params: PiSessionOptionsParams) {
  const cwd = sessionWorkspacePath(params.config.workspaceDir, params.sessionKey);
  const runtimeDir = params.config.runtimeDir;
  mkdirSync(runtimeDir, { recursive: true });

  const modelsJsonPath = writeRuntimeModelsJson(params.config, params.sessionKey);
  const authStorage = AuthStorage.inMemory();
  authStorage.setRuntimeApiKey(params.config.providerId, params.config.apiKey);

  const modelRegistry = ModelRegistry.create(authStorage, modelsJsonPath);
  const model = modelRegistry.find(params.config.providerId, params.config.model);
  if (!model) {
    const loadError = modelRegistry.getError();
    throw new Error(loadError ? `Could not load model: ${loadError}` : `Model not found: ${params.config.providerId}/${params.config.model}`);
  }

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: true },
    retry: { enabled: true, maxRetries: 2 }
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: runtimeDir,
    settingsManager,
    systemPromptOverride: (base) => mergeSystemPrompt(base, buildSystemPrompt({ cwd }))
  });
  await resourceLoader.reload();

  return {
    cwd,
    agentDir: runtimeDir,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: "medium" as const,
    tools: normalizeTools(params.config.tools),
    customTools: createPiAgentTools({ ...params.context, cwd }),
    resourceLoader,
    sessionManager: createSessionManager(cwd, sessionDir(params.config, params.sessionKey), params.agentSessionId),
    settingsManager,
    sessionStartEvent: {
      type: "session_start" as const,
      reason: params.agentSessionId ? "resume" as const : "startup" as const
    }
  };
}

export function writeRuntimeModelsJson(config: AppEnv, sessionKey: string): string {
  process.env.PI_AGENT_API_KEY = config.apiKey;

  const modelsDir = join(config.runtimeDir, "models", encodeURIComponent(sessionKey));
  mkdirSync(modelsDir, { recursive: true });
  const modelsJsonPath = join(modelsDir, "models.json");
  const modelsJson = {
    providers: {
      [config.providerId]: {
        name: providerDisplayName(config.api),
        baseUrl: config.baseUrl,
        api: config.api,
        apiKey: "$PI_AGENT_API_KEY",
        authHeader: true,
        headers: buildCustomHeaders(config, sessionKey),
        compat: providerCompat(config.api),
        models: [
          {
            id: config.model,
            name: config.model,
            reasoning: supportsReasoning(config.api),
            input: ["text"],
            contextWindow: 200000,
            maxTokens: 32000,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0
            },
            thinkingLevelMap: {
              off: null,
              minimal: supportsReasoning(config.api) ? "minimal" : null,
              low: supportsReasoning(config.api) ? "low" : null,
              medium: supportsReasoning(config.api) ? "medium" : null,
              high: supportsReasoning(config.api) ? "high" : null,
              xhigh: supportsReasoning(config.api) ? "xhigh" : null
            }
          }
        ]
      }
    }
  };

  writeFileSync(modelsJsonPath, `${JSON.stringify(modelsJson, null, 2)}\n`, { mode: 0o600 });
  return modelsJsonPath;
}

export function buildCustomHeaders(config: Pick<AppEnv, "serviceChainName">, sessionKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Claw-Session-Key": sessionKey
  };
  if (config.serviceChainName) {
    headers["X-Service-Chain"] = JSON.stringify({ name: config.serviceChainName });
  }
  return headers;
}

function providerDisplayName(api: AppEnv["api"]): string {
  return api === "anthropic-messages" ? "Local Anthropic" : "Local Codex";
}

function providerCompat(api: AppEnv["api"]): Record<string, unknown> {
  if (api === "anthropic-messages") {
    return {
      supportsTemperature: false
    };
  }

  return {
    supportsDeveloperRole: true,
    supportsReasoningEffort: true
  };
}

function supportsReasoning(api: AppEnv["api"]): boolean {
  return api !== "openai-completions" && api !== "anthropic-messages";
}

export function mergeSystemPrompt(base: string | undefined, append: string): string {
  return [base?.trim(), append.trim()].filter(Boolean).join("\n\n---\n\n");
}

export function normalizeTools(tools: string[]): string[] {
  return [...new Set([...tools, "send_image", "send_file"])];
}

function sessionWorkspacePath(workspaceDir: string, sessionKey: string): string {
  const path = join(workspaceDir, encodeURIComponent(sessionKey));
  mkdirSync(path, { recursive: true });
  return path;
}

function sessionDir(config: AppEnv, sessionKey: string): string {
  const path = join(config.runtimeDir, "sessions", encodeURIComponent(sessionKey));
  mkdirSync(path, { recursive: true });
  return path;
}

export function createSessionManager(cwd: string, dir: string, agentSessionId?: string | null): SessionManager {
  if (!agentSessionId) return SessionManager.create(cwd, dir);

  const existing = findSessionFileById(dir, agentSessionId);
  return existing ? SessionManager.open(existing, dir, cwd) : SessionManager.create(cwd, dir, { id: agentSessionId });
}

export function findSessionFileById(dir: string, sessionId: string): string | undefined {
  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith(".jsonl")) continue;
    const path = join(dir, fileName);
    const firstLine = readFileSync(path, "utf8").split(/\r?\n/, 1)[0];
    if (!firstLine) continue;

    try {
      const header = JSON.parse(firstLine) as { type?: unknown; id?: unknown };
      if (header.type === "session" && header.id === sessionId) return path;
    } catch {
      continue;
    }
  }
  return undefined;
}
