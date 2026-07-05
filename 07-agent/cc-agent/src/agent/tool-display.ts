const TOOL_NAMES: Record<string, string> = {
  Bash: "执行命令",
  Read: "读取文件",
  Write: "写入文件",
  Edit: "编辑文件",
  MultiEdit: "批量编辑文件",
  Glob: "搜索文件",
  Grep: "搜索内容",
  LS: "查看目录",
  TodoWrite: "更新待办",
  Agent: "执行子任务",
  Skill: "调用技能",
  send_image: "发送图片",
  send_file: "发送文件",
  mcp__cc_agent__send_image: "发送图片",
  mcp__cc_agent__send_file: "发送文件"
};

const SKILL_NAME_KEYS = new Set(["skill_name", "name", "skill"]);
const FILE_PATH_KEYS = new Set(["file_path", "path"]);
const FILE_NAME_KEYS = new Set(["file_name", "name"]);

export function formatToolDisplay(name: string, input: unknown): string {
  const params = asRecord(input);
  const title = toolDisplayName(name, params);
  const detail = formatToolParams(name, params);
  return detail ? `${title}${detail}` : title;
}

function toolDisplayName(name: string, params: Record<string, unknown>): string {
  if (name === "Skill") {
    const skillName = extractFirstString(params, SKILL_NAME_KEYS);
    return skillName ? `调用技能: ${skillName}` : "调用技能";
  }

  return TOOL_NAMES[name] ?? normalizeMcpToolName(name);
}

function formatToolParams(toolName: string, params: Record<string, unknown>): string {
  if (!Object.keys(params).length || toolName === "Skill") return "";

  if (isSendImageTool(toolName)) {
    const filePath = extractFirstString(params, FILE_PATH_KEYS);
    return filePath ? `: ${basename(filePath)}` : "";
  }

  if (isSendFileTool(toolName)) {
    const fileName = extractFirstString(params, FILE_NAME_KEYS) || extractFirstString(params, FILE_PATH_KEYS);
    return fileName ? `: ${basename(fileName)}` : "";
  }

  return formatKeyParams(params);
}

function formatKeyParams(params: Record<string, unknown>): string {
  const items = Object.entries(params).slice(0, 3);
  if (!items.length) return "";
  return ` (${items.map(([key, value]) => `${key}=${formatValue(value)}`).join(", ")})`;
}

function normalizeMcpToolName(name: string): string {
  const match = /^mcp__[^_]+__(.+)$/.exec(name);
  return match?.[1] ?? name;
}

function isSendImageTool(name: string): boolean {
  return name === "send_image" || name.endsWith("__send_image");
}

function isSendFileTool(name: string): boolean {
  return name === "send_file" || name.endsWith("__send_file");
}

function extractFirstString(params: Record<string, unknown>, keys: Set<string>): string {
  for (const key of keys) {
    const value = params[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatValue(value: unknown): string {
  const text = String(value).replace(/\s+/g, " ");
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}
