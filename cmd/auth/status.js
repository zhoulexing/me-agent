"use strict";

const { readConfig } = require("./config");

if (process.argv.includes("--help")) {
  console.log("用法: zlx-cli auth status [--json]");
  process.exit(0);
}

const getnote = readConfig("getnote", false);
const wechat = readConfig("wechat", false);
const ark = readConfig("ark", false);
const result = {
  getnote: {
    apiKey: Boolean(getnote?.apiKey),
    clientId: Boolean(getnote?.clientId),
  },
  wechat: {
    configured: Boolean(wechat?.appId && wechat?.appSecret),
  },
  ark: { apiKey: Boolean(ark?.apiKey) },
};
if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Get 笔记: ${result.getnote.apiKey ? "已配置 API Key" : "未配置 API Key"}`);
  console.log(`公众号: ${result.wechat.configured ? "已配置" : "未配置"}`);
  console.log(`ARK: ${result.ark.apiKey ? "已配置 API Key" : "未配置 API Key"}`);
}
