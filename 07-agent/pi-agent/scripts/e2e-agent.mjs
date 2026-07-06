import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const projectName = basename(root);
const isPiAgent = projectName === "pi-agent";
const prefix = isPiAgent ? "PI_AGENT" : "CC_AGENT";
const tempRoot = mkdtempSync(join(tmpdir(), `${projectName}-e2e-agent-`));
const timeoutMs = Number(process.env.E2E_AGENT_TIMEOUT_MS ?? 120000);
const prompt = process.env.E2E_AGENT_PROMPT ?? "请只回复两个字：你好";

process.env[`${prefix}_DATA_DIR`] = join(tempRoot, "data");
process.env[`${prefix}_WORKSPACE_DIR`] = join(tempRoot, "workspace");
if (isPiAgent) {
  process.env.PI_AGENT_RUNTIME_DIR = join(tempRoot, "runtime");
}
process.env.FEISHU_ENABLED ??= "false";
process.env.WECHAT_ENABLED ??= "false";

const { loadEnv } = await import("../dist/config/index.js");
const { createApp } = await import("../dist/app.js");

const app = createApp(loadEnv());

try {
  const response = await withTimeout(runAgentRequest(), timeoutMs);

  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`agent e2e returned ${response.status}: ${text}`);
  }

  const result = JSON.parse(text);
  if (result.status !== "success") {
    throw new Error(`agent e2e failed: ${text}`);
  }
  if (typeof result.text !== "string" || !result.text.trim()) {
    throw new Error(`agent e2e returned empty text: ${text}`);
  }

  console.log(`e2e agent ok: ${projectName}`);
  console.log(result.text.trim());
} finally {
  await app.stop();
}

function runAgentRequest() {
  return app.app.request("/agent/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channelId: "wechat",
      appId: "local",
      groupId: `${projectName}-e2e-agent`,
      content: prompt,
      isPrivate: true
    })
  });
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`agent e2e timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
