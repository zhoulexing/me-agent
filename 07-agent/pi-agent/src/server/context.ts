import type { AgentRuntime } from "../agent/runtime.js";
import type { FeishuClient, FeishuConfig } from "../channels/feishu/index.js";
import type { WechatClient, WechatConfig } from "../channels/wechat/index.js";
import type { Repositories } from "../db/index.js";

export type ServerContext = {
  agent: AgentRuntime;
  repositories: Repositories;
  feishu: {
    config: FeishuConfig;
    client: FeishuClient;
  };
  wechat: {
    config: WechatConfig;
    client: WechatClient;
  };
};
