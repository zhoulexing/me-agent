import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const projectName = basename(root);
const isPiAgent = projectName === "pi-agent";
const prefix = isPiAgent ? "PI_AGENT" : "CC_AGENT";
const tempRoot = mkdtempSync(join(tmpdir(), `${projectName}-smoke-`));

process.env[`${prefix}_DATA_DIR`] ??= join(tempRoot, "data");
process.env[`${prefix}_WORKSPACE_DIR`] ??= join(tempRoot, "workspace");
process.env.FEISHU_ENABLED ??= "false";
process.env.WECHAT_ENABLED ??= "false";

if (isPiAgent) {
  process.env.PI_AGENT_API_KEY ??= "smoke-test-key";
  process.env.PI_AGENT_RUNTIME_DIR ??= join(tempRoot, "runtime");
  process.env.PI_AGENT_YBA_CONFIG_PATH ??= join(tempRoot, "missing-yba.json");
  process.env.PI_AGENT_CODEX_CONFIG_PATH ??= join(tempRoot, "missing-codex.toml");
} else {
  process.env.CC_AGENT_YBA_CONFIG_PATH ??= join(tempRoot, "missing-yba.json");
  process.env.CC_AGENT_CLAUDE_SETTINGS_PATH ??= join(tempRoot, "missing-claude.json");
}

const { loadEnv } = await import("../dist/config/index.js");
const { createApp } = await import("../dist/app.js");

const app = createApp(loadEnv());

try {
  await assertJson("/health", 200);
  await assertJson("/agent-data/sessions", 200);
  console.log(`smoke ok: ${projectName}`);
} finally {
  await app.stop();
}

async function assertJson(path, status) {
  const response = await app.app.request(path);
  const text = await response.text();
  if (response.status !== status) {
    throw new Error(`${path} returned ${response.status}, expected ${status}: ${text}`);
  }

  try {
    JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON: ${text}`);
  }
}
