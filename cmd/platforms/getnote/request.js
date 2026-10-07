"use strict";

const { readFileSync } = require("node:fs");
const { headers } = require("../../auth/getnote");

const ORIGIN = "https://openapi.biji.com";
const PREFIX = "/open/api/v1/resource/";

function responseError(status, text) {
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  const reason = data.error?.reason;
  const safeReason = ["qps_global", "qps_bucket", "quota_day", "quota_month", "not_member"].includes(reason) ? reason : "";
  const error = new Error(`Get 笔记${status ? ` HTTP ${status}` : "返回错误"}${safeReason ? `（${safeReason}）` : ""}`);
  error.status = status;
  error.reason = safeReason;
  error.code = data.error?.code;
  error.retryAfter = Number(data.error?.rate_limit?.retry_after ?? data.rate_limit?.retry_after) || undefined;
  return error;
}

async function requestResource(method, rawPath, body) {
  const url = new URL(rawPath, ORIGIN);
  if (!rawPath.startsWith(PREFIX) || url.origin !== ORIGIN || !url.pathname.startsWith(PREFIX))
    throw new Error("不允许访问此地址");
  const response = await fetch(url, {
    method,
    headers: { ...headers(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = responseError(response.status, text);
    const header = response.headers.get("retry-after");
    if (header) error.retryAfter = Number(header) || Math.max(0, (Date.parse(header) - Date.now()) / 1000) || error.retryAfter;
    throw error;
  }
  return text;
}

function usage() {
  return `用法: zlx-cli getnote request GET|POST /open/api/v1/resource/... [--body-file <JSON文件>] [--dry-run|--execute]
示例:
  zlx-cli getnote request POST /open/api/v1/resource/recall --body-file /tmp/query.json
  zlx-cli getnote request GET '/open/api/v1/resource/knowledge/list?page=1'

仅允许访问 Get 笔记 resource API 的相对路径；凭证从项目 .config/getnote.json 读取。`;
}

async function main(argv) {
  if (!argv.length || argv.includes("--help")) {
    console.log(usage());
    return 0;
  }
  const [method, rawPath, ...rest] = argv;
  if (!["GET", "POST"].includes(method) || !rawPath?.startsWith(PREFIX) || rawPath.startsWith("//"))
    throw new Error(usage());
  const url = new URL(rawPath, ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith(PREFIX)) throw new Error("不允许访问此地址");
  let bodyFile = "";
  let dryRun = false;
  let execute = false;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--body-file") bodyFile = rest[++i] || "";
    else if (rest[i] === "--dry-run") dryRun = true;
    else if (rest[i] === "--execute") execute = true;
    else throw new Error(`未知参数: ${rest[i]}`);
  }
  if (dryRun && execute) throw new Error("--dry-run 与 --execute 不能同时使用");
  if (method === "GET" && bodyFile) throw new Error("GET 不接受 --body-file");
  if (method === "POST" && !bodyFile) throw new Error("POST 必须指定 --body-file");
  const body = bodyFile ? readFileSync(bodyFile, "utf8") : undefined;
  if (body) JSON.parse(body); // 只校验，不重新序列化，避免 64 位笔记 ID 丢失精度。
  const readPostPaths = new Set([
    "/open/api/v1/resource/recall",
    "/open/api/v1/resource/recall/knowledge",
    "/open/api/v1/resource/note/task/progress",
  ]);
  const isWrite = method === "POST" && !readPostPaths.has(url.pathname);
  if (isWrite && !execute && !dryRun) throw new Error("此操作会修改 Get 笔记；先用 --dry-run 检查，再在授权后使用 --execute");
  if (dryRun) {
    console.log(JSON.stringify({ method, url: url.toString(), body: body || null, network: false, write: isWrite }, null, 2));
    return 0;
  }
  const text = await requestResource(method, rawPath, body);
  try {
    if (JSON.parse(text).success === false) {
      console.error(text);
      return 1;
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  console.log(text);
  return 0;
}

module.exports = { readResource: (path) => requestResource("GET", path), responseError };
if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  });
}
