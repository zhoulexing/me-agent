import { Hono } from "hono";
import { AgentRuntime } from "./agent/runtime.js";
import { FeishuClient, FeishuRuntime, loadFeishuConfig } from "./channels/feishu/index.js";
import { WechatClient, loadWechatConfig } from "./channels/wechat/index.js";
import type { AppEnv } from "./config/index.js";
import { createRepositories } from "./db/index.js";
import { createRoutes } from "./server/routes/index.js";

export type CcAgentApp = {
  app: Hono;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function createApp(env: AppEnv): CcAgentApp {
  const repositories = createRepositories(env.dataDir);

  const feishuConfig = loadFeishuConfig(env);
  const feishuClient = new FeishuClient(feishuConfig);

  const wechatConfig = loadWechatConfig(env);
  const wechatClient = new WechatClient(wechatConfig);

  const agent = new AgentRuntime({
    config: env,
    repositories
  });

  const feishuRuntime = new FeishuRuntime(feishuConfig, feishuClient, agent);
  const app = createRoutes({
    agent,
    repositories,
    feishu: {
      config: feishuConfig,
      client: feishuClient
    },
    wechat: {
      config: wechatConfig,
      client: wechatClient
    }
  });

  return {
    app,
    async start() {
      await feishuRuntime.start();
    },
    async stop() {
      await feishuRuntime.stop();
    }
  };
}
