import { describe, expect, it } from "vitest";
import { toStreamEvents } from "../../src/agent/client.js";

describe("Pi client event mapping", () => {
  it("emits partial assistant text only when streaming is enabled", () => {
    const event = {
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        delta: "hello"
      }
    };

    expect(toStreamEvents(event as never, "session-1", false)).toEqual([]);
    expect(toStreamEvents(event as never, "session-1", true)).toEqual([
      { type: "assistant", content: "hello", agentSessionId: "session-1" }
    ]);
  });

  it("maps final assistant messages for non-streaming channel updates", () => {
    const event = {
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "final answer" }]
      }
    };

    expect(toStreamEvents(event as never, "session-1", false)).toEqual([
      { type: "assistant", content: "final answer", agentSessionId: "session-1" }
    ]);
  });

  it("does not synthesize duplicate result events from agent_end", () => {
    const event = {
      type: "agent_end",
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "final answer" }]
        }
      ],
      willRetry: false
    };

    expect(toStreamEvents(event as never, "session-1", false)).toEqual([]);
  });
});
