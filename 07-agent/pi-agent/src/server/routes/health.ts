import { Hono } from "hono";

export function createHealthRoutes() {
  const app = new Hono();

  app.get("/", (c) => c.json({ ok: true }));

  return app;
}
