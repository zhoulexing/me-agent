import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { AgentRunParams } from "../../agent/model.js";
import { ChannelId } from "../../channels/types.js";
import type { ServerContext } from "../context.js";

const AgentMessageSchema = z.object({
  channelId: z.nativeEnum(ChannelId).default(ChannelId.Wechat),
  appId: z.string().default("local"),
  groupId: z.string().default("local"),
  threadId: z.string().optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  replyTo: z.string().optional(),
  content: z.string().min(1),
  isPrivate: z.boolean().default(true)
});

export function createAgentRoutes(ctx: ServerContext) {
  const app = new Hono();

  app.post("/messages", async (c) => {
    const message = toAgentRunParams(AgentMessageSchema.parse(await c.req.json()));
    const result = await ctx.agent.run(message);
    return c.json(result);
  });

  app.post("/messages/stream", async (c) => {
    const message = toAgentRunParams(AgentMessageSchema.parse(await c.req.json()));

    return streamSSE(c, async (stream) => {
      await ctx.agent.run(message, {
        stream: true,
        onEvent: async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event)
          });
        }
      });
    });
  });

  return app;
}

function toAgentRunParams(input: z.infer<typeof AgentMessageSchema>): AgentRunParams {
  return {
    ...input,
    source: "user"
  };
}
