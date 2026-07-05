import { existsSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentToolContext } from "./context.js";

export function createSendImageTool(context: AgentToolContext) {
  return tool(
    "send_image",
    "Send a local image file to the current chat channel.",
    {
      file_path: z.string().min(1).describe("Absolute path or path relative to the current workspace.")
    },
    async ({ file_path }) => {
      const filePath = resolveToolPath(context.cwd, file_path);
      const check = validateFile(filePath);
      if (check) return textResult(check);
      if (!context.callbacks?.onImage) return textResult("当前运行没有配置图片输出回调。");

      await context.callbacks.onImage({ type: "image", filePath, fileName: basename(filePath) });
      await context.callbacks.onEvent?.({ type: "image", filePath, fileName: basename(filePath) });
      return textResult(`已发送图片：${basename(filePath)}`);
    },
    { alwaysLoad: true }
  );
}

export function createSendFileTool(context: AgentToolContext) {
  return tool(
    "send_file",
    "Send a local file to the current chat channel.",
    {
      file_path: z.string().min(1).describe("Absolute path or path relative to the current workspace."),
      file_name: z.string().min(1).optional().describe("Optional display name for the uploaded file.")
    },
    async ({ file_path, file_name }) => {
      const filePath = resolveToolPath(context.cwd, file_path);
      const check = validateFile(filePath);
      if (check) return textResult(check);
      if (!context.callbacks?.onFile) return textResult("当前运行没有配置文件输出回调。");

      const fileName = file_name || basename(filePath);
      await context.callbacks.onFile({ type: "file", filePath, fileName });
      await context.callbacks.onEvent?.({ type: "file", filePath, fileName });
      return textResult(`已发送文件：${file_name || basename(filePath)}`);
    },
    { alwaysLoad: true }
  );
}

function resolveToolPath(cwd: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
}

function validateFile(filePath: string): string {
  if (!existsSync(filePath)) return `文件不存在：${filePath}`;

  const stat = statSync(filePath);
  if (!stat.isFile()) return `路径不是文件：${filePath}`;
  if (stat.size === 0) return `文件为空：${filePath}`;
  return "";
}

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }]
  };
}
