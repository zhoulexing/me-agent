"use strict";

const { clientId } = require("../../auth/getnote");

async function main(args) {
  if (args.includes("--help")) {
    console.log("用法: zlx-cli getnote oauth device [--client-id <ID>]");
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== "--client-id" || !args[1]))
    throw new Error("用法: zlx-cli getnote oauth device [--client-id <ID>]");
  const response = await fetch("https://openapi.biji.com/open/api/v1/oauth/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: args[1] || clientId() }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Get 笔记 HTTP ${response.status}: ${text.slice(0, 500)}`);
  console.log(text);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
