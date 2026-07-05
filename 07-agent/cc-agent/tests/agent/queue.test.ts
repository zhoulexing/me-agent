import { describe, expect, it } from "vitest";
import { SessionQueue } from "../../src/agent/queue.js";

describe("SessionQueue", () => {
  it("serializes tasks for the same key", async () => {
    const queue = new SessionQueue();
    const events: string[] = [];

    const first = queue.enqueue("a", async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push("first:end");
    });

    const second = queue.enqueue("a", async () => {
      events.push("second:start");
      events.push("second:end");
    });

    await Promise.all([first, second]);

    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
