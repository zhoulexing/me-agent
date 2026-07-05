import { migrateDatabase, openDatabase } from "./connection.js";
import { MessagesRepository } from "./repositories/messages.js";
import { RunsRepository } from "./repositories/runs.js";
import { SessionsRepository } from "./repositories/sessions.js";

export function createRepositories(dataDir: string) {
  const db = openDatabase(dataDir);
  migrateDatabase(db);

  return {
    db,
    sessions: new SessionsRepository(db),
    messages: new MessagesRepository(db),
    runs: new RunsRepository(db)
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
