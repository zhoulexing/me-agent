#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const { join, resolve } = require("node:path");
const { homedir } = require("node:os");
const { readConfig } = require("./auth/config");

const ROOT = resolve(__dirname, "..");
const HELP = `zlx-cli - me-agent 统一命令入口

用法: zlx-cli <领域> <操作> [参数]

本地业务:
  record add|search          写入或检索每日记录
  doc read|setup             读取文档或准备文档运行环境
  video prepare|transcribe|review|subtitles
  wechat cover|compose       准备公众号封面与正文 HTML
  skill link|unlink          管理 Skill 软链接

平台:
  getnote request            调用 Get 笔记 OpenAPI
  getnote oauth device        申请设备授权码
  getnote oauth poll         轮询设备授权
  getnote image upload       上传图片
  wechat check-config|draft|update|read-published
  ark image                 生成或编辑图片

基础:
  auth status                查看凭证配置状态（不显示凭证）

各操作可使用 --help 查看参数。`;

function run(program, relativePath, args) {
  const result = spawnSync(program, [resolve(ROOT, relativePath), ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function pythonWith(moduleName) {
  const config = readConfig("zlx-cli", false);
  const candidates = [config?.python, "python3", "python", join(homedir(), "miniforge3/bin/python3")];
  for (const candidate of candidates.filter(Boolean)) {
    const probe = spawnSync(candidate, ["-c", `import ${moduleName}`], { stdio: "ignore" });
    if (probe.status === 0) return candidate;
  }
  throw new Error(`没有找到包含 ${moduleName} 的 Python；可在项目 .config/zlx-cli.json 中设置 python`);
}

function main(argv) {
  if (argv[0] === "wechat" && argv[1] === "read-published")
    return run(process.execPath, "cmd/platforms/wechat/read-published-article.mjs", argv.slice(2));
  if (!argv.length || argv.includes("--help") || argv.includes("-h") || argv[0] === "help") {
    console.log(HELP);
    return 0;
  }
  const [group, action, ...rest] = argv;
  if (group === "auth" && action === "status")
    return run(process.execPath, "cmd/auth/status.js", rest);
  if (group === "record" && ["add", "search"].includes(action))
    return run(process.execPath, "cmd/business/record.js", [action, ...rest]);
  if (group === "doc" && action === "read")
    return run(readConfig("zlx-cli", false)?.documentPython || "python3", "cmd/business/document/doc_load.py", rest);
  if (group === "doc" && action === "setup")
    return run("bash", "cmd/business/document/setup.sh", rest);
  const video = {
    prepare: ["bash", "cmd/business/video/prepare_video.sh"],
    transcribe: ["bash", "cmd/business/video/transcribe_zh.sh"],
    review: ["python3", "cmd/business/video/json_to_review.py"],
    subtitles: ["python3", "cmd/business/video/build_subtitles.py"],
  };
  if (group === "video" && video[action])
    return run(video[action][0], video[action][1], rest);
  if (group === "wechat" && action === "cover")
    return run(process.execPath, "cmd/business/wechat/prepare-cover.mjs", rest);
  if (group === "wechat" && action === "compose")
    return run(process.execPath, "cmd/business/wechat/compose-wechat-html.mjs", rest);
  if (group === "wechat" && ["check-config", "draft", "update"].includes(action))
    return run(process.execPath, "cmd/platforms/wechat/publish-wechat-article.mjs", [action, ...rest]);
  if (group === "getnote" && action === "request")
    return run(process.execPath, "cmd/platforms/getnote/request.js", rest);
  if (group === "getnote" && action === "oauth" && rest[0] === "device")
    return run(process.execPath, "cmd/platforms/getnote/device.js", rest.slice(1));
  if (group === "getnote" && action === "oauth" && rest[0] === "poll")
    return run("python3", "cmd/platforms/getnote/oauth_poll.py", rest.slice(1));
  if (group === "getnote" && action === "image" && rest[0] === "upload")
    return run(pythonWith("requests"), "cmd/platforms/getnote/upload_image.py", rest.slice(1));
  if (group === "ark" && action === "image")
    return run("python3", "cmd/platforms/ark/image_gen.py", rest);
  if (group === "skill" && ["link", "unlink"].includes(action))
    return run("bash", "cmd/business/skill/link-skill.sh", [action, ...rest]);
  console.error(`未知命令: ${argv.join(" ")}\n\n${HELP}`);
  return 2;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
