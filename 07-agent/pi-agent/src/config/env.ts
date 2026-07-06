import "dotenv/config";
import { join } from "node:path";
import { z } from "zod";

export type PiApi = "openai-responses" | "openai-codex-responses" | "openai-completions" | "anthropic-messages";

const BooleanEnvSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

const StringEnvSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}, z.string().optional());

const RawEnvSchema = z.object({
  PI_AGENT_HOST: StringEnvSchema,
  PI_AGENT_PORT: z.coerce.number().int().positive().optional(),
  PI_AGENT_DATA_DIR: StringEnvSchema,
  PI_AGENT_WORKSPACE_DIR: StringEnvSchema,
  PI_AGENT_RUNTIME_DIR: StringEnvSchema,
  PI_AGENT_API: StringEnvSchema,
  PI_AGENT_API_KEY: StringEnvSchema,
  PI_AGENT_BASE_URL: StringEnvSchema,
  PI_AGENT_MODEL: StringEnvSchema,
  PI_AGENT_PROVIDER_ID: StringEnvSchema,
  PI_AGENT_TOOLS: StringEnvSchema,
  CODEX_API: StringEnvSchema,
  CODEX_API_KEY: StringEnvSchema,
  CODEX_BASE_URL: StringEnvSchema,
  CODEX_MODEL: StringEnvSchema,
  CODEX_PROVIDER_ID: StringEnvSchema,
  OPENAI_API_KEY: StringEnvSchema,
  CLAUDE_MODEL: StringEnvSchema,
  ANTHROPIC_MODEL: StringEnvSchema,
  ANTHROPIC_DEFAULT_SONNET_MODEL: StringEnvSchema,
  ANTHROPIC_BASE_URL: StringEnvSchema,
  ANTHROPIC_AUTH_TOKEN: StringEnvSchema,
  ANTHROPIC_API_KEY: StringEnvSchema,
  AI_GATEWAY_SERVICE_CHAIN_NAME: StringEnvSchema,
  SERVICE_CHAIN_NAME: StringEnvSchema,
  FEISHU_ENABLED: BooleanEnvSchema,
  FEISHU_APP_ID: StringEnvSchema,
  FEISHU_APP_SECRET: StringEnvSchema,
  FEISHU_VERIFICATION_TOKEN: StringEnvSchema,
  FEISHU_ENCRYPT_KEY: StringEnvSchema,
  CHANNEL_LARK_APP_ID: StringEnvSchema,
  CHANNEL_LARK_APP_SECRET: StringEnvSchema,
  WECHAT_ENABLED: BooleanEnvSchema,
  WECHAT_APP_ID: StringEnvSchema,
  WECHAT_BRIDGE_BASE_URL: StringEnvSchema,
  WECHAT_BRIDGE_TOKEN: StringEnvSchema
});

export type AppEnv = {
  host: string;
  port: number;
  dataDir: string;
  workspaceDir: string;
  runtimeDir: string;
  providerId: string;
  model: string;
  api: PiApi;
  apiKey: string;
  baseUrl: string;
  tools: string[];
  serviceChainName?: string;
  feishu: {
    enabled: boolean;
    appId: string;
    appSecret: string;
    verificationToken?: string;
    encryptKey?: string;
  };
  wechat: {
    enabled: boolean;
    appId: string;
    bridgeBaseUrl?: string;
    bridgeToken?: string;
  };
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TOOLS = ["read", "grep", "find", "ls", "bash", "edit", "write", "send_image", "send_file"];

export function loadEnv(): AppEnv {
  const env = RawEnvSchema.parse(process.env);
  const anthropicBaseUrl = env.ANTHROPIC_BASE_URL;
  const anthropicApiKey = env.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_API_KEY;
  const api = parseApi(env.PI_AGENT_API ?? env.CODEX_API ?? (anthropicBaseUrl && anthropicApiKey ? "anthropic-messages" : undefined));
  const apiKey = resolveApiKey(api, env, anthropicApiKey);

  if (!apiKey) {
    throw new Error("Missing PI_AGENT_API_KEY. You can also provide CODEX_API_KEY, OPENAI_API_KEY, ANTHROPIC_AUTH_TOKEN, or ANTHROPIC_API_KEY.");
  }

  const dataDir = env.PI_AGENT_DATA_DIR ?? join(process.cwd(), ".data");

  return {
    host: env.PI_AGENT_HOST ?? "127.0.0.1",
    port: env.PI_AGENT_PORT ?? 8787,
    dataDir,
    workspaceDir: env.PI_AGENT_WORKSPACE_DIR ?? join(dataDir, "workspace"),
    runtimeDir: env.PI_AGENT_RUNTIME_DIR ?? join(dataDir, "runtime"),
    providerId: env.PI_AGENT_PROVIDER_ID ?? env.CODEX_PROVIDER_ID ?? defaultProviderId(api),
    model: resolveModel(api, env),
    api,
    apiKey,
    baseUrl: env.PI_AGENT_BASE_URL ?? env.CODEX_BASE_URL ?? (api === "anthropic-messages" ? anthropicBaseUrl : undefined) ?? DEFAULT_BASE_URL,
    tools: parseTools(env.PI_AGENT_TOOLS),
    serviceChainName: env.AI_GATEWAY_SERVICE_CHAIN_NAME ?? env.SERVICE_CHAIN_NAME,
    feishu: {
      enabled: env.FEISHU_ENABLED ?? false,
      appId: env.FEISHU_APP_ID ?? env.CHANNEL_LARK_APP_ID ?? "",
      appSecret: env.FEISHU_APP_SECRET ?? env.CHANNEL_LARK_APP_SECRET ?? "",
      verificationToken: env.FEISHU_VERIFICATION_TOKEN,
      encryptKey: env.FEISHU_ENCRYPT_KEY
    },
    wechat: {
      enabled: env.WECHAT_ENABLED ?? false,
      appId: env.WECHAT_APP_ID ?? "default",
      bridgeBaseUrl: env.WECHAT_BRIDGE_BASE_URL,
      bridgeToken: env.WECHAT_BRIDGE_TOKEN
    }
  };
}

function parseApi(value: string | undefined): PiApi {
  const api = value ?? "openai-responses";
  if (api === "openai-responses" || api === "openai-codex-responses" || api === "openai-completions" || api === "anthropic-messages") return api;
  throw new Error(`Unsupported PI_AGENT_API "${api}". Expected openai-responses, openai-codex-responses, openai-completions, or anthropic-messages.`);
}

function resolveApiKey(api: PiApi, env: z.infer<typeof RawEnvSchema>, anthropicApiKey: string | undefined): string | undefined {
  if (env.PI_AGENT_API_KEY) return env.PI_AGENT_API_KEY;
  if (api === "anthropic-messages") return anthropicApiKey ?? env.CODEX_API_KEY ?? env.OPENAI_API_KEY;
  return env.CODEX_API_KEY ?? env.OPENAI_API_KEY ?? anthropicApiKey;
}

function defaultProviderId(api: PiApi): string {
  return api === "anthropic-messages" ? "local-anthropic" : "local-codex";
}

function resolveModel(api: PiApi, env: z.infer<typeof RawEnvSchema>): string {
  if (env.PI_AGENT_MODEL) return env.PI_AGENT_MODEL;
  if (api === "anthropic-messages") {
    return (
      env.CLAUDE_MODEL ??
      env.ANTHROPIC_MODEL ??
      env.ANTHROPIC_DEFAULT_SONNET_MODEL ??
      "claude-sonnet-4-20250514"
    );
  }
  return env.CODEX_MODEL ?? "gpt-5.3-codex-spark";
}

function parseTools(value: string | undefined): string[] {
  return value?.split(",").map((toolName) => toolName.trim()).filter(Boolean) ?? DEFAULT_TOOLS;
}
