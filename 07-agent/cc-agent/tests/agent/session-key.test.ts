import { describe, expect, it } from "vitest";
import { ChannelId } from "../../src/channels/types.js";
import { buildQueueKey, buildSessionKey, parseSessionKey } from "../../src/agent/session-key.js";

describe("session key", () => {
  it("round-trips channel identity", () => {
    const sessionKey = buildSessionKey({
      channelId: ChannelId.Feishu,
      appId: "cli:app",
      groupId: "chat/a:b"
    });

    expect(parseSessionKey(sessionKey)).toEqual({
      channelId: ChannelId.Feishu,
      appId: "cli:app",
      groupId: "chat/a:b"
    });
  });

  it("adds thread to queue key only when present", () => {
    const base = {
      channelId: ChannelId.Wechat,
      appId: "default",
      groupId: "group-1"
    };

    expect(buildQueueKey(base)).toBe(buildSessionKey(base));
    expect(buildQueueKey({ ...base, threadId: "topic:1" })).toContain("topic%3A1");
  });
});
