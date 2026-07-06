import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

copyDir("src/agent/prompts", "dist/agent/prompts");
copyDir("src/db/migrations", "dist/db/migrations");

function copyDir(from, to) {
  const source = join(root, from);
  const target = join(root, to);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}
