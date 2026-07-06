import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPT_FILES = ["AGENTS.md", "TOOL.md", "SOUL.md"] as const;

export function buildSystemPrompt(context: { cwd: string }): string {
  const sections = PROMPT_FILES.map((fileName) => readPromptFile(fileName)).filter(Boolean);
  sections.push(buildWorkspacePrompt(context.cwd));
  return sections.join("\n\n---\n\n");
}

function buildWorkspacePrompt(cwd: string): string {
  return [
    "# WORKSPACE",
    "",
    `Current working directory: ${cwd}`,
    "",
    "Use this directory as the default workspace for reading, writing, and running commands.",
    "Do not ask the user for the working directory unless they explicitly want to switch to another workspace."
  ].join("\n");
}

function readPromptFile(fileName: string): string {
  const path = resolvePromptPath(fileName);
  return path ? readFileSync(path, "utf8").trim() : "";
}

function resolvePromptPath(fileName: string): string | undefined {
  for (const dir of promptDirs()) {
    const path = join(dir, fileName);
    if (existsSync(path)) return path;
  }
  return undefined;
}

function promptDirs(): string[] {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return [
    join(process.cwd(), "src/agent/prompts"),
    join(process.cwd(), "dist/agent/prompts"),
    join(currentDir, "prompts")
  ];
}
