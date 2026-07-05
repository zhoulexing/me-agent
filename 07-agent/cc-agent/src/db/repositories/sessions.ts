import type { Db } from "../connection.js";
import type { AgentSessionRecord } from "../schema.js";
import { nowIso } from "../../utils/time.js";

export class SessionsRepository {
  constructor(private readonly db: Db) {}

  find(sessionKey: string, threadId: string): AgentSessionRecord | undefined {
    return this.db
      .prepare("SELECT * FROM agent_sessions WHERE session_key = ? AND thread_id = ?")
      .get(sessionKey, threadId) as AgentSessionRecord | undefined;
  }

  getOrCreate(sessionKey: string, threadId: string): AgentSessionRecord {
    const existing = this.find(sessionKey, threadId);
    if (existing) return existing;

    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO agent_sessions (session_key, thread_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(sessionKey, threadId, now, now);

    const created = this.find(sessionKey, threadId);
    if (!created) {
      throw new Error("Failed to create agent session");
    }
    return created;
  }

  updateAgentSessionId(id: number, agentSessionId: string): void {
    this.db
      .prepare("UPDATE agent_sessions SET agent_session_id = ?, updated_at = ? WHERE id = ?")
      .run(agentSessionId, nowIso(), id);
  }

  updateLastRoute(params: {
    id: number;
    replyTo?: string;
    senderId?: string;
    senderName?: string;
    isPrivate: boolean;
  }): void {
    this.db
      .prepare(
        `UPDATE agent_sessions
         SET last_reply_to = ?, last_sender_id = ?, last_sender_name = ?, last_is_private = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        params.replyTo ?? null,
        params.senderId ?? null,
        params.senderName ?? null,
        params.isPrivate ? 1 : 0,
        nowIso(),
        params.id
      );
  }
}
