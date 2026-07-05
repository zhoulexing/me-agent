import type { Db } from "../connection.js";
import type { ChannelMessageRecord } from "../schema.js";
import { nowIso } from "../../utils/time.js";
import type { AgentRunParams } from "../../agent/model.js";

export class MessagesRepository {
  constructor(private readonly db: Db) {}

  createInbound(sessionId: number, message: AgentRunParams): ChannelMessageRecord {
    const result = this.db
      .prepare(
        `INSERT INTO channel_messages
          (session_id, source, direction, content, sender_id, sender_name, reply_to, created_at)
         VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?)`
      )
      .run(
        sessionId,
        message.source,
        message.content,
        message.senderId ?? null,
        message.senderName ?? null,
        message.replyTo ?? null,
        nowIso()
      );

    return this.findById(Number(result.lastInsertRowid));
  }

  createOutbound(sessionId: number, content: string): ChannelMessageRecord {
    const result = this.db
      .prepare(
        `INSERT INTO channel_messages (session_id, source, direction, content, created_at)
         VALUES (?, 'background', 'outbound', ?, ?)`
      )
      .run(sessionId, content, nowIso());

    return this.findById(Number(result.lastInsertRowid));
  }

  private findById(id: number): ChannelMessageRecord {
    const row = this.db.prepare("SELECT * FROM channel_messages WHERE id = ?").get(id) as ChannelMessageRecord | undefined;
    if (!row) {
      throw new Error(`Missing channel message: ${id}`);
    }
    return row;
  }
}
