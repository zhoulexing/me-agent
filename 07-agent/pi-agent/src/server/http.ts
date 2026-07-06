import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export type HttpServerOptions = {
  app: Hono;
  host: string;
  port: number;
};

export function startHttpServer(options: HttpServerOptions): void {
  serve({
    fetch: options.app.fetch,
    hostname: options.host,
    port: options.port
  });
}
