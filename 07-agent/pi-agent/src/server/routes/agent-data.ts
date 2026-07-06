import { Hono } from "hono";
import type { ServerContext } from "../context.js";

type SqlValue = string | number | null;

export function createAgentDataRoutes(ctx: ServerContext) {
  const app = new Hono();

  app.get("/sessions", (c) => {
    const limit = readLimit(c.req.query("limit"));
    const offset = readOffset(c.req.query("offset"));
    const rows = ctx.repositories.db
      .prepare(
        `SELECT id, session_key, thread_id, agent_session_id, status,
          last_reply_to, last_sender_id, last_sender_name, last_is_private,
          created_at, updated_at
        FROM agent_sessions
        ORDER BY id DESC
        LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    return c.json({ data: rows, pagination: { limit, offset } });
  });

  app.get("/sessions/:id", (c) => {
    const session = resolveSession(ctx, c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    return c.json({ data: session });
  });

  app.get("/sessions/:id/messages", (c) => {
    const session = resolveSession(ctx, c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    return c.json(
      listChannelMessages(ctx, {
        sessionId: readRowId(session),
        direction: c.req.query("direction"),
        limit: readLimit(c.req.query("limit")),
        offset: readOffset(c.req.query("offset"))
      })
    );
  });

  app.get("/sessions/:id/runs", (c) => {
    const session = resolveSession(ctx, c.req.param("id"));
    if (!session) return c.json({ error: "session not found" }, 404);

    return c.json(
      listAgentRuns(ctx, {
        sessionId: readRowId(session),
        status: c.req.query("status"),
        limit: readLimit(c.req.query("limit")),
        offset: readOffset(c.req.query("offset"))
      })
    );
  });

  app.get("/messages", (c) => {
    return c.json(
      listChannelMessages(ctx, {
        sessionId: readOptionalId(c.req.query("sessionId")),
        direction: c.req.query("direction"),
        limit: readLimit(c.req.query("limit")),
        offset: readOffset(c.req.query("offset"))
      })
    );
  });

  app.get("/runs", (c) => {
    return c.json(
      listAgentRuns(ctx, {
        sessionId: readOptionalId(c.req.query("sessionId")),
        status: c.req.query("status"),
        limit: readLimit(c.req.query("limit")),
        offset: readOffset(c.req.query("offset"))
      })
    );
  });

  app.get("/runs/:id", (c) => {
    const id = readId(c.req.param("id"));
    if (!id) return c.json({ error: "invalid run id" }, 400);

    const run = ctx.repositories.db
      .prepare(
        `SELECT r.*, s.session_key, s.thread_id, m.content AS input_content
        FROM agent_runs r
        JOIN agent_sessions s ON s.id = r.session_id
        LEFT JOIN channel_messages m ON m.id = r.input_message_id
        WHERE r.id = ?`
      )
      .get(id);
    if (!run) return c.json({ error: "run not found" }, 404);

    const events = ctx.repositories.db.prepare("SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY id ASC").all(id);
    const sdkEvents = ctx.repositories.db.prepare("SELECT * FROM sdk_events WHERE run_id = ? ORDER BY id ASC").all(id);
    return c.json({ data: { run, events, sdkEvents } });
  });

  app.get("/runs/:id/events", (c) => {
    const runId = readId(c.req.param("id"));
    if (!runId) return c.json({ error: "invalid run id" }, 400);

    const events = ctx.repositories.db.prepare("SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY id ASC").all(runId);
    return c.json({ data: events });
  });

  app.get("/sdk-events", (c) => {
    const limit = readLimit(c.req.query("limit"));
    const offset = readOffset(c.req.query("offset"));
    const { where, values } = buildWhere([
      ["run_id = ?", readOptionalId(c.req.query("runId"))],
      ["session_id = ?", readOptionalId(c.req.query("sessionId"))],
      ["level = ?", c.req.query("level") || null],
      ["event_name = ?", c.req.query("eventName") || null]
    ]);

    const rows = ctx.repositories.db
      .prepare(
        `SELECT id, run_id, session_id, level, event_name, sdk_payload, created_at
        FROM sdk_events
        ${where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?`
      )
      .all(...values, limit, offset);

    return c.json({ data: rows, pagination: { limit, offset } });
  });

  return app;
}

function resolveSession(ctx: ServerContext, value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;

  const rowId = readId(value);
  if (rowId) {
    return (ctx.repositories.db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(rowId) as Record<string, unknown> | undefined) ?? null;
  }

  return (
    (ctx.repositories.db.prepare("SELECT * FROM agent_sessions WHERE agent_session_id = ?").get(value) as Record<string, unknown> | undefined) ??
    null
  );
}

function readRowId(row: Record<string, unknown>): number {
  const id = Number(row.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid session row id");
  return id;
}

function listChannelMessages(
  ctx: ServerContext,
  params: { sessionId?: number | null; direction?: string; limit: number; offset: number }
) {
  const { where, values } = buildWhere([
    ["session_id = ?", params.sessionId ?? null],
    ["direction = ?", normalizeDirection(params.direction)]
  ]);

  const rows = ctx.repositories.db
    .prepare(
      `SELECT id, session_id, message_uid, source, direction, content,
        sender_id, sender_name, reply_to, channel_payload, created_at
      FROM channel_messages
      ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?`
    )
    .all(...values, params.limit, params.offset);

  return { data: rows, pagination: { limit: params.limit, offset: params.offset } };
}

function listAgentRuns(ctx: ServerContext, params: { sessionId?: number | null; status?: string; limit: number; offset: number }) {
  const { where, values } = buildWhere([
    ["r.session_id = ?", params.sessionId ?? null],
    ["r.status = ?", normalizeRunStatus(params.status)]
  ]);

  const rows = ctx.repositories.db
    .prepare(
      `SELECT r.id, r.session_id, r.input_message_id, r.status, r.error,
        r.started_at, r.finished_at, s.session_key, s.thread_id,
        m.content AS input_content
      FROM agent_runs r
      JOIN agent_sessions s ON s.id = r.session_id
      LEFT JOIN channel_messages m ON m.id = r.input_message_id
      ${where}
      ORDER BY r.id DESC
      LIMIT ? OFFSET ?`
    )
    .all(...values, params.limit, params.offset);

  return { data: rows, pagination: { limit: params.limit, offset: params.offset } };
}

function buildWhere(filters: Array<[string, SqlValue | undefined]>): { where: string; values: SqlValue[] } {
  const clauses: string[] = [];
  const values: SqlValue[] = [];

  for (const [clause, value] of filters) {
    if (value === undefined || value === null || value === "") continue;
    clauses.push(clause);
    values.push(value);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values
  };
}

function readId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function readOptionalId(value: string | undefined): number | null {
  if (!value) return null;
  return readId(value);
}

function readLimit(value: string | undefined): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) return 50;
  return Math.min(limit, 200);
}

function readOffset(value: string | undefined): number {
  const offset = Number(value);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

function normalizeDirection(value: string | undefined): string | null {
  if (!value) return null;
  return value === "inbound" || value === "outbound" ? value : null;
}

function normalizeRunStatus(value: string | undefined): string | null {
  if (!value) return null;
  return ["running", "finished", "failed"].includes(value) ? value : null;
}
