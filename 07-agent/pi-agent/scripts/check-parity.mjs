import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const projectName = basename(projectRoot);
const siblingName = projectName === "cc-agent" ? "pi-agent" : "cc-agent";
const siblingRoot = join(dirname(projectRoot), siblingName);

const errors = [];

if (!existsSync(siblingRoot)) {
  fail(`Missing sibling project: ${siblingRoot}`);
} else {
  checkSourceShape();
  checkSharedFiles();
  checkRouteSets();
  checkTestShape();
  checkPackageScripts();
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`parity ok: ${projectName} <-> ${siblingName}`);

function checkSourceShape() {
  const own = normalizeSourceFiles(listFiles(join(projectRoot, "src"), projectRoot));
  const sibling = normalizeSourceFiles(listFiles(join(siblingRoot, "src"), siblingRoot));
  assertSameSet("normalized src files", own, sibling);
}

function checkSharedFiles() {
  const sharedFiles = [
    "scripts/clean-dist.mjs",
    "scripts/copy-assets.mjs",
    "scripts/doctor.mjs",
    "scripts/e2e-agent.mjs",
    "scripts/smoke-dist.mjs",
    "scripts/verify.mjs",
    "vitest.config.ts",
    "src/agent/queue.ts",
    "src/agent/session-key.ts",
    "src/agent/tools/context.ts",
    "src/agent/tools/index.ts",
    "src/channels/types.ts",
    "src/channels/feishu/message.ts",
    "src/channels/feishu/runtime.ts",
    "src/channels/feishu/streaming-card-reply.ts",
    "src/channels/wechat/client.ts",
    "src/channels/wechat/config.ts",
    "src/channels/wechat/inbound.ts",
    "src/channels/wechat/index.ts",
    "src/channels/wechat/message.ts",
    "src/channels/wechat/runtime.ts",
    "src/db/index.ts",
    "src/db/schema.ts",
    "src/db/repositories/messages.ts",
    "src/db/repositories/runs.ts",
    "src/db/repositories/sessions.ts",
    "src/db/migrations/001_initial.sql",
    "src/server/context.ts",
    "src/server/http.ts",
    "src/server/routes/agent.ts",
    "src/server/routes/agent-data.ts",
    "src/server/routes/channels.ts",
    "src/server/routes/health.ts",
    "src/server/routes/index.ts",
    "src/utils/time.ts"
  ];

  for (const file of sharedFiles) {
    const ownPath = join(projectRoot, file);
    const siblingPath = join(siblingRoot, file);
    if (!existsSync(ownPath) || !existsSync(siblingPath)) {
      fail(`Missing shared file: ${file}`);
      continue;
    }
    if (readFileSync(ownPath, "utf8") !== readFileSync(siblingPath, "utf8")) {
      fail(`Shared file drifted: ${file}`);
    }
  }
}

function checkRouteSets() {
  const ownRoutes = extractRoutes(projectRoot);
  const siblingRoutes = extractRoutes(siblingRoot);
  assertSameSet("HTTP routes", ownRoutes, siblingRoutes);
}

function checkTestShape() {
  const own = normalizeTestFiles(listFiles(join(projectRoot, "tests"), projectRoot));
  const sibling = normalizeTestFiles(listFiles(join(siblingRoot, "tests"), siblingRoot));
  assertSameSet("normalized test files", own, sibling);
}

function checkPackageScripts() {
  const ownPkg = readJson(join(projectRoot, "package.json"));
  const siblingPkg = readJson(join(siblingRoot, "package.json"));
  const required = ["dev", "start", "build", "typecheck", "test", "parity", "smoke", "verify", "doctor", "e2e:agent"];

  for (const script of required) {
    if (!ownPkg.scripts?.[script]) fail(`Missing package script in ${projectName}: ${script}`);
    if (!siblingPkg.scripts?.[script]) fail(`Missing package script in ${siblingName}: ${script}`);
  }
}

function normalizeSourceFiles(files) {
  return files
    .filter((file) => file.startsWith("src/"))
    .filter((file) => file !== "src/agent/background-watch.ts")
    .filter((file) => file !== "src/agent/session.ts")
    .map((file) => file.replace(/agent\/mcps\/cc-agent\.ts$/, "agent/mcps/agent-sdk.ts"))
    .map((file) => file.replace(/agent\/mcps\/pi-agent\.ts$/, "agent/mcps/agent-sdk.ts"))
    .sort();
}

function normalizeTestFiles(files) {
  return files
    .filter((file) => file.startsWith("tests/"))
    .filter((file) => file !== "tests/agent/background-watch.test.ts")
    .filter((file) => file !== "tests/agent/claude-client-background.test.ts")
    .map((file) => file.replace(/claude-client-/g, "agent-client-"))
    .map((file) => file.replace(/pi-client-/g, "agent-client-"))
    .sort();
}

function extractRoutes(root) {
  const routeDir = join(root, "src/server/routes");
  return listFiles(routeDir, root)
    .flatMap((file) => {
      const content = readFileSync(join(root, file), "utf8");
      return [...content.matchAll(/app\.(get|post|put|delete|patch)\("([^"]+)"/g)].map((match) => `${match[1].toUpperCase()} ${match[2]}`);
    })
    .sort();
}

function assertSameSet(label, ownValues, siblingValues) {
  const own = new Set(ownValues);
  const sibling = new Set(siblingValues);
  const missing = [...sibling].filter((value) => !own.has(value));
  const extra = [...own].filter((value) => !sibling.has(value));

  if (missing.length) fail(`${label} missing in ${projectName}: ${missing.join(", ")}`);
  if (extra.length) fail(`${label} extra in ${projectName}: ${extra.join(", ")}`);
}

function listFiles(root, baseRoot = projectRoot) {
  if (!existsSync(root)) return [];
  const result = [];
  walk(root, result);
  return result.map((file) => relative(baseRoot, file)).sort();
}

function walk(path, result) {
  for (const entry of readdirSync(path)) {
    const child = join(path, entry);
    const stat = statSync(child);
    if (stat.isDirectory()) {
      walk(child, result);
      continue;
    }
    if (stat.isFile()) result.push(child);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message) {
  errors.push(message);
}
