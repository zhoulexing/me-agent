import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/index.js";

describe("loadEnv", () => {
  it("parses string boolean environment variables explicitly", () => {
    withEnv(
      {
        PI_AGENT_API_KEY: "test-key",
        FEISHU_ENABLED: "false",
        WECHAT_ENABLED: "false"
      },
      () => {
        const env = loadEnv();
        expect(env.feishu.enabled).toBe(false);
        expect(env.wechat.enabled).toBe(false);
      }
    );
  });

  it("accepts true-like string booleans", () => {
    withEnv(
      {
        PI_AGENT_API_KEY: "test-key",
        FEISHU_ENABLED: "true",
        WECHAT_ENABLED: "1"
      },
      () => {
        const env = loadEnv();
        expect(env.feishu.enabled).toBe(true);
        expect(env.wechat.enabled).toBe(true);
      }
    );
  });

  it("uses Anthropic env as the default compatible provider", () => {
    withEnv(
      {
        ANTHROPIC_BASE_URL: "https://api.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "anthropic-token",
        ANTHROPIC_MODEL: "MiniMax-M3",
        FEISHU_ENABLED: "false",
        WECHAT_ENABLED: "false"
      },
      () => {
        const env = loadEnv();
        expect(env.api).toBe("anthropic-messages");
        expect(env.providerId).toBe("local-anthropic");
        expect(env.baseUrl).toBe("https://api.example.com/anthropic");
        expect(env.apiKey).toBe("anthropic-token");
        expect(env.model).toBe("MiniMax-M3");
      }
    );
  });

  it("treats blank env values as unset", () => {
    withEnv(
      {
        ANTHROPIC_BASE_URL: "https://api.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "anthropic-token",
        ANTHROPIC_MODEL: "MiniMax-M3",
        PI_AGENT_API: "",
        PI_AGENT_PROVIDER_ID: "",
        PI_AGENT_BASE_URL: "",
        PI_AGENT_API_KEY: "",
        PI_AGENT_MODEL: "",
        FEISHU_ENABLED: "",
        WECHAT_ENABLED: ""
      },
      () => {
        const env = loadEnv();
        expect(env.api).toBe("anthropic-messages");
        expect(env.providerId).toBe("local-anthropic");
        expect(env.baseUrl).toBe("https://api.example.com/anthropic");
        expect(env.apiKey).toBe("anthropic-token");
        expect(env.model).toBe("MiniMax-M3");
        expect(env.feishu.enabled).toBe(false);
        expect(env.wechat.enabled).toBe(false);
      }
    );
  });
});

function withEnv(values: Record<string, string>, run: () => void): void {
  const keys = new Set([
    ...Object.keys(values),
    "PI_AGENT_API",
    "PI_AGENT_API_KEY",
    "PI_AGENT_BASE_URL",
    "PI_AGENT_MODEL",
    "PI_AGENT_PROVIDER_ID",
    "CODEX_API",
    "CODEX_API_KEY",
    "CODEX_BASE_URL",
    "CODEX_MODEL",
    "CODEX_PROVIDER_ID",
    "OPENAI_API_KEY",
    "CLAUDE_MODEL",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "FEISHU_ENABLED",
    "WECHAT_ENABLED"
  ]);
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
