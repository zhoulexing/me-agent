import type { AppEnv } from "../../config/index.js";

export type FeishuConfig = {
  enabled: boolean;
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
};

export function loadFeishuConfig(env: AppEnv): FeishuConfig {
  return {
    enabled: env.feishu.enabled,
    appId: env.feishu.appId,
    appSecret: env.feishu.appSecret,
    verificationToken: env.feishu.verificationToken,
    encryptKey: env.feishu.encryptKey
  };
}
