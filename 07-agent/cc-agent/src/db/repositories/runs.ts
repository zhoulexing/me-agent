import type { Db } from "../connection.js";
import type { AgentRunRecord } from "../schema.js";
import { nowIso } from "../../utils/time.js";

export class RunsRepository {
  constructor(private readonly db: Db) {}

  start(sessionId: number, inputMessageId: number): AgentRunRecord {
    const result = this.db
      .prepare(
        `INSERT INTO agent_runs (session_id, input_message_id, status, started_at)
         VALUES (?, ?, 'running', ?)`
      )
      .run(sessionId, inputMessageId, nowIso());

    return this.findById(Number(result.lastInsertRowid));
  }

  finish(id: number): void {
    this.db
      .prepare("UPDATE agent_runs SET status = 'finished', finished_at = ? WHERE id = ?")
      .run(nowIso(), id);
  }

  fail(id: number, error: unknown): void {
    this.db
      .prepare("UPDATE agent_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?")
      .run(error instanceof Error ? error.message : String(error), nowIso(), id);
  }

  addEvent(runId: number, eventType: string, content?: string): void {
    this.db
      .prepare(
        `INSERT INTO agent_run_events (run_id, event_type, content, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(runId, eventType, content ?? null, nowIso());
  }

  private findById(id: number): AgentRunRecord {
    const row = this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as AgentRunRecord | undefined;
    if (!row) {
      throw new Error(`Missing agent run: ${id}`);
    }
    return row;
  }
}
