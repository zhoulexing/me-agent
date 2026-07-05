import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

type PiApi = "openai-responses" | "openai-codex-responses" | "openai-completions";

interface AppConfig {
  api: PiApi;
  apiKey: string;
  baseUrl: string;
  cwd: string;
  modelId: string;
  providerId: string;
  runtimeDir: string;
  tools: string[];
}

const DEFAULT_TOOLS = ["read", "grep", "find", "ls", "bash", "edit", "write"];
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function loadDotEnv(projectDir: string): Promise<void> {
  const dotEnvPath = path.join(projectDir, ".env");
  let content: string;
  try {
    content = await readFile(dotEnvPath, "utf8");
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

async function readCodexConfig(): Promise<{ apiKey?: string; model?: string }> {
  const configPath = path.join(os.homedir(), ".codex", "config.toml");
  let content: string;
  try {
    content = await readFile(configPath, "utf8");
  } catch {
    return {};
  }

  return {
    apiKey: content.match(/^env_key\s*=\s*"([^"]+)"/m)?.[1],
    model: content.match(/^model\s*=\s*"([^"]+)"/m)?.[1],
  };
}

function parseApi(value: string | undefined): PiApi {
  const api = value ?? "openai-responses";
  if (api === "openai-responses" || api === "openai-codex-responses" || api === "openai-completions") {
    return api;
  }
  throw new Error(`Unsupported CODEX_API "${api}". Expected openai-responses, openai-codex-responses, or openai-completions.`);
}

async function loadConfig(): Promise<AppConfig> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(moduleDir, "..");
  await loadDotEnv(projectDir);

  const codexConfig = await readCodexConfig();
  const apiKey = env("CODEX_API_KEY") ?? env("OPENAI_API_KEY") ?? codexConfig.apiKey;
  const baseUrl = env("CODEX_BASE_URL") ?? DEFAULT_BASE_URL;

  if (!apiKey) {
    throw new Error("Missing CODEX_API_KEY. You can also provide OPENAI_API_KEY or set env_key in ~/.codex/config.toml.");
  }

  return {
    api: parseApi(env("CODEX_API")),
    apiKey,
    baseUrl,
    cwd: path.resolve(env("PI_AGENT_CWD") ?? projectDir),
    modelId: env("CODEX_MODEL") ?? codexConfig.model ?? "gpt-5.3-codex-spark",
    providerId: env("CODEX_PROVIDER_ID") ?? "local-codex",
    runtimeDir: path.join(projectDir, ".pi-agent-runtime"),
    tools: (env("PI_AGENT_TOOLS")?.split(",").map((tool) => tool.trim()).filter(Boolean) ?? DEFAULT_TOOLS),
  };
}

async function writeRuntimeModelsJson(config: AppConfig): Promise<string> {
  await mkdir(config.runtimeDir, { recursive: true });

  // Keep secrets out of files. Pi resolves this from process.env at request time.
  process.env.CODEX_API_KEY = config.apiKey;

  const modelsJsonPath = path.join(config.runtimeDir, "models.json");
  const modelsJson = {
    providers: {
      [config.providerId]: {
        name: "Local Codex",
        baseUrl: config.baseUrl,
        api: config.api,
        apiKey: "$CODEX_API_KEY",
        authHeader: true,
        compat: {
          supportsDeveloperRole: true,
          supportsReasoningEffort: true,
        },
        models: [
          {
            id: config.modelId,
            name: config.modelId,
            reasoning: config.api !== "openai-completions",
            input: ["text"],
            contextWindow: 200000,
            maxTokens: 32000,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
            },
            thinkingLevelMap: {
              off: null,
              minimal: "minimal",
              low: "low",
              medium: "medium",
              high: "high",
              xhigh: "xhigh",
            },
          },
        ],
      },
    },
  };

  await writeFile(modelsJsonPath, `${JSON.stringify(modelsJson, null, 2)}\n`, { mode: 0o600 });
  return modelsJsonPath;
}

function promptFromArgs(): string | undefined {
  const [, , ...args] = process.argv;
  const prompt = args.join(" ").trim();
  return prompt || undefined;
}

function extractAssistantText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;

  const candidate = message as {
    role?: unknown;
    content?: unknown;
    errorMessage?: unknown;
  };
  if (candidate.role !== "assistant") return undefined;

  if (typeof candidate.errorMessage === "string" && candidate.errorMessage.trim()) {
    return `Assistant error: ${candidate.errorMessage}`;
  }

  if (!Array.isArray(candidate.content)) return undefined;

  const text = candidate.content
    .filter((item): item is { type: "text"; text: string } => {
      return Boolean(
        item &&
          typeof item === "object" &&
          (item as { type?: unknown }).type === "text" &&
          typeof (item as { text?: unknown }).text === "string",
      );
    })
    .map((item) => item.text)
    .join("");

  return text.trim() ? text : undefined;
}

async function runPrompt(session: Awaited<ReturnType<typeof createAgentSession>>["session"], prompt: string): Promise<void> {
  printedAssistantText = false;
  await session.prompt(prompt);
  if (!printedAssistantText) {
    const lastAssistantMessage = [...session.state.messages].reverse().find((message) => {
      return message && typeof message === "object" && (message as { role?: unknown }).role === "assistant";
    });
    const finalText = extractAssistantText(lastAssistantMessage);
    if (finalText) {
      output.write(finalText);
    }
  }
  output.write("\n");
}

let printedAssistantText = false;

async function main(): Promise<void> {
  const config = await loadConfig();
  const modelsJsonPath = await writeRuntimeModelsJson(config);

  const authStorage = AuthStorage.inMemory();
  authStorage.setRuntimeApiKey(config.providerId, config.apiKey);

  const modelRegistry = ModelRegistry.create(authStorage, modelsJsonPath);
  const model = modelRegistry.find(config.providerId, config.modelId);
  if (!model) {
    const loadError = modelRegistry.getError();
    throw new Error(loadError ? `Could not load model: ${loadError}` : `Model not found: ${config.providerId}/${config.modelId}`);
  }

  const { session } = await createAgentSession({
    cwd: config.cwd,
    agentDir: config.runtimeDir,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: "medium",
    tools: config.tools,
    sessionManager: SessionManager.inMemory(),
  });

  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      printedAssistantText = true;
      output.write(event.assistantMessageEvent.delta);
    }
    if (event.type === "tool_execution_start") {
      output.write(`\n[tool] ${event.toolName}\n`);
    }
  });

  try {
    const firstPrompt = promptFromArgs();
    if (firstPrompt) {
      await runPrompt(session, firstPrompt);
      return;
    }

    output.write(`pi-agent ready: ${config.providerId}/${config.modelId}\n`);
    output.write(`cwd: ${config.cwd}\n`);
    output.write("Type a message, or /exit to quit.\n\n");

    const rl = createInterface({ input, output });
    try {
      for (;;) {
        const line = (await rl.question("> ")).trim();
        if (!line) continue;
        if (line === "/exit" || line === "/quit") break;
        await runPrompt(session, line);
      }
    } finally {
      rl.close();
    }
  } finally {
    session.dispose();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pi-agent failed: ${message}`);
  process.exitCode = 1;
});
