"use strict";

const { existsSync, readFileSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");

const CONFIG_DIR = resolve(__dirname, "../..", ".config");

function configPath(name) {
  if (!["getnote", "wechat", "ark", "zlx-cli"].includes(name))
    throw new Error(`未知配置: ${name}`);
  return join(CONFIG_DIR, `${name}.json`);
}

function readConfig(name, required = true) {
  const path = configPath(name);
  if (!existsSync(path)) {
    if (!required) return null;
    throw new Error(`缺少配置文件: ${path}`);
  }
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error(`配置路径不是文件: ${path}`);
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
    throw new Error(`配置文件权限过宽，请执行 chmod 600 '${path}'`);
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`配置文件不是有效 JSON: ${path}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error(`配置文件必须是 JSON 对象: ${path}`);
  return data;
}

module.exports = { configPath, readConfig };
