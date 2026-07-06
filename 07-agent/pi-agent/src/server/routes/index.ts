import { Hono } from "hono";
import type { ServerContext } from "../context.js";
import { createAgentDataRoutes } from "./agent-data.js";
import { createAgentRoutes } from "./agent.js";
import { createChannelRoutes } from "./channels.js";
import { createHealthRoutes } from "./health.js";

export function createRoutes(ctx: ServerContext) {
  const app = new Hono();

  app.route("/agent", createAgentRoutes(ctx));
  app.route("/agent-data", createAgentDataRoutes(ctx));
  app.route("/health", createHealthRoutes());
  app.route("/channels", createChannelRoutes(ctx));

  return app;
}
