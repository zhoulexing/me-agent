import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/config/index.js";
import {
  buildCustomHeaders,
  findSessionFileById,
  mergeSystemPrompt,
  normalizeTools,
  writeRuntimeModelsJson
} from "../../src/agent/client-option.js";

describe("Pi client options", () => {
  it("keeps channel tools enabled even when the configured tool allowlist is narrow", () => {
    expect(normalizeTools(["read", "bash"])).toEqual(["read", "bash", "send_image", "send_file"]);
  });

  it("appends pi-agent prompts to the Pi base system prompt", () => {
    expect(mergeSystemPrompt("base prompt", "custom prompt")).toBe("base prompt\n\n---\n\ncustom prompt");
    expect(mergeSystemPrompt(undefined, "custom prompt")).toBe("custom prompt");
  });

  it("writes per-session model config with session headers", () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "pi-agent-runtime-"));
    const config = createEnv(runtimeDir);
    const path = writeRuntimeModelsJson(config, "feishu:app:group");
    const models = JSON.parse(readFileSync(path, "utf8")) as {
      providers: Record<string, { headers: Record<string, string> }>;
    };

    expect(path).toContain(encodeURIComponent("feishu:app:group"));
    expect(models.providers["local-codex"].headers).toEqual({
      "Claw-Session-Key": "feishu:app:group",
      "X-Service-Chain": JSON.stringify({ name: "test-chain" })
    });
  });

  it("writes Anthropic-compatible model config without reasoning controls", () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "pi-agent-runtime-"));
    const config: AppEnv = {
      ...createEnv(runtimeDir),
      providerId: "local-anthropic",
      model: "MiniMax-M3",
      api: "anthropic-messages",
      baseUrl: "https://api.example.com/anthropic"
    };
    const path = writeRuntimeModelsJson(config, "feishu:app:group");
    const models = JSON.parse(readFileSync(path, "utf8")) as {
      providers: Record<string, { name: string; api: string; authHeader: boolean; compat: Record<string, unknown>; models: Array<{ reasoning: boolean; thinkingLevelMap: Record<string, string | null> }> }>;
    };
    const provider = models.providers["local-anthropic"];

    expect(provider.name).toBe("Local Anthropic");
    expect(provider.api).toBe("anthropic-messages");
    expect(provider.authHeader).toBe(true);
    expect(provider.compat).toEqual({ supportsTemperature: false });
    expect(provider.models[0].reasoning).toBe(false);
    expect(provider.models[0].thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: null,
      xhigh: null
    });
  });

  it("finds an existing Pi session file by agent_session_id", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-agent-session-"));
    writeFileSync(join(dir, "2026-01-01T00-00-00-000Z_session-a.jsonl"), JSON.stringify({ type: "session", id: "session-a" }));
    writeFileSync(join(dir, "2026-01-01T00-00-01-000Z_session-b.jsonl"), JSON.stringify({ type: "session", id: "session-b" }));

    expect(findSessionFileById(dir, "session-b")).toContain("session-b.jsonl");
    expect(findSessionFileById(dir, "missing")).toBeUndefined();
  });
});

function createEnv(runtimeDir: string): AppEnv {
  return {
    host: "127.0.0.1",
    port: 8787,
    dataDir: runtimeDir,
    workspaceDir: runtimeDir,
    runtimeDir,
    providerId: "local-codex",
    model: "gpt-test",
    api: "openai-responses",
    apiKey: "test-key",
    baseUrl: "http://127.0.0.1:8080/v1",
    tools: ["read"],
    serviceChainName: "test-chain",
    feishu: {
      enabled: false,
      appId: "",
      appSecret: ""
    },
    wechat: {
      enabled: false,
      appId: "default"
    }
  };
}
