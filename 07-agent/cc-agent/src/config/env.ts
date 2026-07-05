import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const RawEnvSchema = z.object({
  CC_AGENT_HOST: z.string().optional(),
  CC_AGENT_PORT: z.coerce.number().int().positive().optional(),
  CC_AGENT_DATA_DIR: z.string().optional(),
  CC_AGENT_WORKSPACE_DIR: z.string().optional(),
  CC_AGENT_YBA_CONFIG_PATH: z.string().optional(),
  CC_AGENT_CLAUDE_SETTINGS_PATH: z.string().optional(),
  CLAUDE_MODEL: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ANTHROPIC_DEFAULT_SONNET_MODEL: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_CONFIG_DIR: z.string().optional(),
  CLAUDE_CODE_MAX_CONTEXT_TOKENS: z.string().optional(),
  CLAUDE_CODE_AUTO_COMPACT_WINDOW: z.string().optional(),
  AI_GATEWAY_SERVICE_CHAIN_NAME: z.string().optional(),
  SERVICE_CHAIN_NAME: z.string().optional(),
  FEISHU_ENABLED: z.coerce.boolean().optional(),
  FEISHU_APP_ID: z.string().optional(),
  FEISHU_APP_SECRET: z.string().optional(),
  FEISHU_VERIFICATION_TOKEN: z.string().optional(),
  FEISHU_ENCRYPT_KEY: z.string().optional(),
  CHANNEL_LARK_APP_ID: z.string().optional(),
  CHANNEL_LARK_APP_SECRET: z.string().optional(),
  WECHAT_ENABLED: z.coerce.boolean().optional(),
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_BRIDGE_BASE_URL: z.string().optional(),
  WECHAT_BRIDGE_TOKEN: z.string().optional()
});

export type AppEnv = {
  host: string;
  port: number;
  dataDir: string;
  workspaceDir: string;
  claudeConfigDir?: string;
  model: string;
  anthropicBaseUrl?: string;
  anthropicAuthToken?: string;
  anthropicApiKey?: string;
  maxContextTokens?: string;
  compactThresholdTokens?: string;
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

export function loadEnv(): AppEnv {
  const env = RawEnvSchema.parse(process.env);
  const yba = readJson(env.CC_AGENT_YBA_CONFIG_PATH ?? expandHome("~/.youzan-business-assistant/config.json"));
  const claude = readJson(env.CC_AGENT_CLAUDE_SETTINGS_PATH ?? expandHome("~/.claude/settings.json"));
  const claudeEnv = getObject(claude, "env");
  const ybaAgents = getObject(yba, "agents");
  const ybaPaths = getObject(yba, "paths");
  const ybaFeishu = getObject(getObject(yba, "channels"), "feishu");
  const ybaWechat = getObject(getObject(yba, "channels"), "weixin");
  const ybaWechatAccount = firstObject(ybaWechat.accounts);

  const homeDir = stringValue(ybaPaths.home_dir) ?? expandHome("~/.youzan-business-assistant");

  return {
    host: env.CC_AGENT_HOST ?? "127.0.0.1",
    port: env.CC_AGENT_PORT ?? 8787,
    dataDir: env.CC_AGENT_DATA_DIR ?? join(homeDir, "cc-agent"),
    workspaceDir: env.CC_AGENT_WORKSPACE_DIR ?? stringValue(ybaPaths.workspace_dir) ?? join(homeDir, "workspace"),
    claudeConfigDir: env.CLAUDE_CONFIG_DIR ?? stringValue(claudeEnv.CLAUDE_CONFIG_DIR) ?? stringValue(ybaPaths.claude_config_dir),
    model:
      env.CLAUDE_MODEL ??
      env.ANTHROPIC_MODEL ??
      stringValue(claudeEnv.ANTHROPIC_MODEL) ??
      stringValue(claudeEnv.ANTHROPIC_DEFAULT_SONNET_MODEL) ??
      stringValue(ybaAgents.model) ??
      "claude-sonnet-4-20250514",
    anthropicBaseUrl:
      env.ANTHROPIC_BASE_URL ??
      stringValue(claudeEnv.ANTHROPIC_BASE_URL) ??
      stringValue(ybaAgents.anthropic_base_url),
    anthropicAuthToken:
      env.ANTHROPIC_AUTH_TOKEN ??
      stringValue(claudeEnv.ANTHROPIC_AUTH_TOKEN) ??
      stringValue(ybaAgents.anthropic_auth_token),
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? stringValue(claudeEnv.ANTHROPIC_API_KEY),
    maxContextTokens:
      env.CLAUDE_CODE_MAX_CONTEXT_TOKENS ??
      stringValue(claudeEnv.CLAUDE_CODE_MAX_CONTEXT_TOKENS) ??
      numberString(ybaAgents.max_context_tokens),
    compactThresholdTokens:
      env.CLAUDE_CODE_AUTO_COMPACT_WINDOW ??
      stringValue(claudeEnv.CLAUDE_CODE_AUTO_COMPACT_WINDOW) ??
      numberString(ybaAgents.compact_threshold_tokens),
    serviceChainName:
      env.AI_GATEWAY_SERVICE_CHAIN_NAME ??
      env.SERVICE_CHAIN_NAME ??
      stringValue(ybaAgents.service_chain_name),
    feishu: {
      enabled: env.FEISHU_ENABLED ?? booleanValue(ybaFeishu.enabled) ?? false,
      appId: env.FEISHU_APP_ID ?? env.CHANNEL_LARK_APP_ID ?? stringValue(ybaFeishu.app_id) ?? "",
      appSecret: env.FEISHU_APP_SECRET ?? env.CHANNEL_LARK_APP_SECRET ?? stringValue(ybaFeishu.app_secret) ?? "",
      verificationToken: env.FEISHU_VERIFICATION_TOKEN ?? stringValue(ybaFeishu.verification_token),
      encryptKey: env.FEISHU_ENCRYPT_KEY ?? stringValue(ybaFeishu.encrypt_key)
    },
    wechat: {
      enabled: env.WECHAT_ENABLED ?? booleanValue(ybaWechat.enabled) ?? false,
      appId: env.WECHAT_APP_ID ?? stringValue(ybaWechat.app_id) ?? stringValue(ybaWechatAccount.account_id) ?? "default",
      bridgeBaseUrl: env.WECHAT_BRIDGE_BASE_URL ?? stringValue(ybaWechat.send_api_base_url) ?? stringValue(ybaWechat.base_url),
      bridgeToken: env.WECHAT_BRIDGE_TOKEN ?? stringValue(ybaWechatAccount.token)
    }
  };
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function expandHome(path: string): string {
  if (!path.startsWith("~/")) return path;
  return join(process.env.HOME ?? "", path.slice(2));
}

function getObject(source: unknown, key: string): Record<string, unknown> {
  if (!source || typeof source !== "object") return {};
  const value = (source as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstObject(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) return {};
  const first = value[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberString(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : stringValue(value);
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
