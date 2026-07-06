import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Db = Database.Database;

export function openDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });

  const db = new Database(join(dataDir, "pi-agent.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function migrateDatabase(db: Db): void {
  const migrationPath = resolveMigrationPath("001_initial.sql");
  db.exec(readFileSync(migrationPath, "utf8"));
}

function resolveMigrationPath(fileName: string): string {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "migrations", fileName),
    join(process.cwd(), "src", "db", "migrations", fileName)
  ];

  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`Missing database migration: ${fileName}`);
  }
  return path;
}
