import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CONFIG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../..', '.config', 'wechat.json');

function readCredentialConfig(explicitPath = '') {
  const path = resolve(explicitPath || DEFAULT_CONFIG_PATH);
  if (!existsSync(path)) return { path, appId: '', appSecret: '' };
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error(`公众号凭证配置不是文件: ${path}`);
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    throw new Error(`公众号凭证配置权限过宽，请执行 chmod 600 '${path}'`);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`公众号凭证配置不是有效 JSON: ${path}`);
  }
  return { path, appId: String(data.appId || '').trim(), appSecret: String(data.appSecret || '').trim() };
}

export function credentials(explicitPath = '') {
  const config = readCredentialConfig(explicitPath);
  if (!config.appId || !config.appSecret) {
    throw new Error(`未配置公众号凭证：请在 ${config.path} 中填写 appId 和 appSecret，并将文件权限设为 600`);
  }
  return { ...config, source: 'config-file' };
}
