import type { AppEnv } from "../../config/index.js";

export type WechatConfig = {
  enabled: boolean;
  appId: string;
  bridgeBaseUrl?: string;
  bridgeToken?: string;
};

export function loadWechatConfig(env: AppEnv): WechatConfig {
  return {
    enabled: env.wechat.enabled,
    appId: env.wechat.appId,
    bridgeBaseUrl: env.wechat.bridgeBaseUrl,
    bridgeToken: env.wechat.bridgeToken
  };
}
