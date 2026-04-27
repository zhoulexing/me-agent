import type { IncomingMessage, ServerResponse } from "node:http";
import { validateZlxWebhookSecret } from "./security.js";
import { handleZlxHttpInbound } from "./inbound.js";
import type { CoreConfig } from "./types.js";

export function createZlxHttpHandler(params: {
  cfg: CoreConfig;
}): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { cfg } = params;
  const secret = cfg.channels?.zlx?.webhookSecret;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (secret && !validateZlxWebhookSecret(req.headers["x-zlx-webhook-secret"] as string | undefined, secret)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    if (req.method === "GET") {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, channel: "zlx" }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }

    const result = await handleZlxHttpInbound({ body, cfg });
    res.writeHead(result.status);
    res.end(result.body);
  };
}