import type { WechatConfig } from "./config.js";
import type { WechatBridgeMessage, WechatSendTarget } from "./message.js";

export class WechatClient {
  constructor(private readonly config: WechatConfig) {}

  async receive(input: unknown): Promise<WechatBridgeMessage | null> {
    if (!input || typeof input !== "object") return null;
    return input as WechatBridgeMessage;
  }

  async sendText(target: WechatSendTarget, text: string): Promise<void> {
    await this.sendMessage(target, { type: "text", text });
  }

  async sendImage(target: WechatSendTarget, filePath: string): Promise<void> {
    await this.sendMessage(target, { type: "image", filePath });
  }

  async sendFile(target: WechatSendTarget, filePath: string, fileName: string): Promise<void> {
    await this.sendMessage(target, { type: "file", filePath, fileName });
  }

  private async sendMessage(target: WechatSendTarget, payload: Record<string, unknown>): Promise<void> {
    if (!this.config.bridgeBaseUrl) {
      throw new Error("Missing WECHAT_BRIDGE_BASE_URL");
    }

    const response = await fetch(new URL("/messages", this.config.bridgeBaseUrl), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        appId: this.config.appId,
        groupId: target.groupId,
        threadId: target.threadId,
        replyTo: target.replyTo,
        ...payload
      })
    });

    if (response.ok) return;
    throw new Error(`Wechat bridge send failed: ${response.status} ${await response.text()}`);
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (this.config.bridgeToken) {
      headers.authorization = `Bearer ${this.config.bridgeToken}`;
    }

    return headers;
  }
}
