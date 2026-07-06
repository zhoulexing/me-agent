import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const projectName = basename(root);
const isPiAgent = projectName === "pi-agent";
const strictChannels = process.argv.includes("--strict-channels") || process.env.DOCTOR_STRICT_CHANNELS === "true";
const issues = [];
const warnings = [];

let env;

try {
  const config = await import("../dist/config/index.js");
  env = config.loadEnv();
} catch (error) {
  fail(`failed to load dist config: ${getErrorMessage(error)}`);
}

if (env) {
  checkCommon(env);
  if (isPiAgent) {
    checkPi(env);
  } else {
    checkClaude(env);
  }
  checkFeishu(env);
  checkWechat(env);
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (issues.length) {
  console.error(issues.map((issue) => `error: ${issue}`).join("\n"));
  process.exit(1);
}

console.log(`doctor ok: ${projectName}`);

function checkCommon(config) {
  requireValue(config.host, "host");
  requireValue(config.port, "port");
  requireValue(config.dataDir, "dataDir");
  requireValue(config.workspaceDir, "workspaceDir");
  requireValue(config.model, "model");
}

function checkClaude(config) {
  if (!config.anthropicApiKey && !config.anthropicAuthToken) {
    fail("missing Anthropic credential: set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, or configure ~/.claude/settings.json");
  }
}

function checkPi(config) {
  requireValue(config.runtimeDir, "runtimeDir");
  requireValue(config.providerId, "providerId");
  requireValue(config.api, "api");
  requireValue(config.apiKey, "apiKey");
  requireValue(config.baseUrl, "baseUrl");
  if (!Array.isArray(config.tools) || !config.tools.length) fail("tools must not be empty");
}

function checkFeishu(config) {
  if (!config.feishu?.enabled) {
    warnOrFail("Feishu is disabled; set FEISHU_ENABLED=true for Feishu WebSocket e2e.");
    return;
  }
  requireValue(config.feishu.appId, "feishu.appId");
  requireValue(config.feishu.appSecret, "feishu.appSecret");
}

function checkWechat(config) {
  if (!config.wechat?.enabled) {
    warnOrFail("WeChat is disabled; set WECHAT_ENABLED=true for WeChat bridge e2e.");
    return;
  }
  requireValue(config.wechat.appId, "wechat.appId");
  requireValue(config.wechat.bridgeBaseUrl, "wechat.bridgeBaseUrl");
}

function requireValue(value, label) {
  if (value === undefined || value === null || value === "") fail(`missing ${label}`);
}

function warnOrFail(message) {
  if (strictChannels) {
    fail(message);
  } else {
    warnings.push(message);
  }
}

function fail(message) {
  issues.push(message);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
