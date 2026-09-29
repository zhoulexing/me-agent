"use strict";

const DEFAULT_CLIENT_ID = "cli_a1b2c3d4e5f6789012345678abcdef90";
const { configPath, readConfig } = require("./config");

function clientId() {
  return String(readConfig("getnote", false)?.clientId || DEFAULT_CLIENT_ID).trim();
}

function headers() {
  const apiKey = String(readConfig("getnote")?.apiKey || "").trim();
  if (!apiKey) throw new Error(`请在 ${configPath("getnote")} 中配置 apiKey`);
  return {
    Authorization: apiKey,
    "X-Client-ID": clientId(),
  };
}

module.exports = { headers, clientId, DEFAULT_CLIENT_ID };
