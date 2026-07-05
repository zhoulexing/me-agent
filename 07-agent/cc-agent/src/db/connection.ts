import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Db = Database.Database;

export function openDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });

  const db = new Database(join(dataDir, "cc-agent.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function migrateDatabase(db: Db): void {
  const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "migrations", "001_initial.sql");
  db.exec(readFileSync(migrationPath, "utf8"));
}
