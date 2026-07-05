import { Hono } from "hono";
import { basename } from "node:path";
import type { ServerContext } from "../context.js";
import { normalizeInbound as normalizeFeishuInbound } from "../../channels/feishu/index.js";
import { resolveSendTarget as resolveFeishuSendTarget } from "../../channels/feishu/message.js";
import { normalizeInbound as normalizeWechatInbound } from "../../channels/wechat/index.js";
import { resolveSendTarget as resolveWechatSendTarget } from "../../channels/wechat/message.js";

export function createChannelRoutes(ctx: ServerContext) {
  const app = new Hono();

  app.post("/feishu/events", async (c) => {
    if (!ctx.feishu.config.enabled) return c.json({ ok: false, error: "feishu disabled" }, 404);

    const body = await c.req.json();
    const challenge = ctx.feishu.client.resolveChallenge(body);
    if (challenge) return c.json({ challenge });

    const message = await normalizeFeishuInbound(body, ctx.feishu.client, ctx.feishu.config);
    if (!message) return c.json({ ok: true, ignored: true });

    await ctx.agent.run(message, {
      onImage: async (event) => {
        await ctx.feishu.client.sendImage(resolveFeishuSendTarget(message, { reply: false }), event.filePath);
      },
      onFile: async (event) => {
        await ctx.feishu.client.sendFile(resolveFeishuSendTarget(message, { reply: false }), event.filePath, event.fileName || basename(event.filePath));
      },
      onFinish: async (event) => {
        if (event.result.text) {
          await ctx.feishu.client.sendText(resolveFeishuSendTarget(message), event.result.text);
        }
      }
    });
    return c.json({ ok: true });
  });

  app.post("/wechat/events", async (c) => {
    if (!ctx.wechat.config.enabled) return c.json({ ok: false, error: "wechat disabled" }, 404);

    const body = await c.req.json();
    const message = await normalizeWechatInbound(body, ctx.wechat.client, ctx.wechat.config);
    if (!message) return c.json({ ok: true, ignored: true });

    await ctx.agent.run(message, {
      onImage: async (event) => {
        await ctx.wechat.client.sendImage(resolveWechatSendTarget(message, { reply: false }), event.filePath);
      },
      onFile: async (event) => {
        await ctx.wechat.client.sendFile(resolveWechatSendTarget(message, { reply: false }), event.filePath, event.fileName || basename(event.filePath));
      },
      onFinish: async (event) => {
        if (event.result.text) {
          await ctx.wechat.client.sendText(resolveWechatSendTarget(message), event.result.text);
        }
      }
    });
    return c.json({ ok: true });
  });

  return app;
}
