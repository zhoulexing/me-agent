#!/usr/bin/env node

import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 可直接在这里填写；留空时读取同名环境变量。
const WECHAT_APP_ID = 'wx6f647828bec5f47a';
const WECHAT_APP_SECRET = '3a3d9e8f0043bc4b7c5a63dbed4bb7b1';

const API_ROOT = 'https://api.weixin.qq.com/cgi-bin';
const REQUEST_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) args[key] = true;
    else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function usage() {
  return `用法:
  publish-wechat-article.mjs draft --title <标题> --html-file <HTML> --cover-image <图片> [--author <作者>] [--digest <摘要>] [--dry-run]
  publish-wechat-article.mjs update --media-id <草稿media_id> --title <标题> --html-file <HTML> --cover-image <图片> [--dry-run]`;
}

function fail(message, details) {
  const payload = { success: false, error: message };
  if (details !== undefined) payload.details = details;
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

function credentials() {
  const appId = WECHAT_APP_ID || process.env.WECHAT_APP_ID || '';
  const appSecret = WECHAT_APP_SECRET || process.env.WECHAT_APP_SECRET || '';
  if (!appId || !appSecret) {
    throw new Error('未配置公众号凭证：请填写脚本顶部的 WECHAT_APP_ID / WECHAT_APP_SECRET，或设置同名环境变量');
  }
  return { appId, appSecret };
}

function mimeFor(filename, fallback = 'application/octet-stream') {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[extname(filename).toLowerCase()] || fallback;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

async function fetchChecked(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response;
}

async function jsonChecked(url, options = {}) {
  const response = await fetchChecked(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`微信接口返回了非 JSON 内容: ${text.slice(0, 200)}`);
  }
  if (data.errcode && data.errcode !== 0) {
    if (data.errcode === 40164) throw new Error(`调用 IP 不在公众号白名单中: ${data.errmsg || ''}`);
    if (data.errcode === 40001) throw new Error('AppSecret 无效，请检查账号配置');
    if (data.errcode === 40013) throw new Error('AppID 无效，请检查账号配置');
    throw new Error(`微信接口错误 ${data.errcode}: ${data.errmsg || JSON.stringify(data)}`);
  }
  return data;
}

async function getAccessToken(appId, appSecret) {
  const query = new URLSearchParams({
    grant_type: 'client_credential',
    appid: appId,
    secret: appSecret,
  });
  const data = await jsonChecked(`${API_ROOT}/token?${query.toString()}`);
  if (!data.access_token) throw new Error('获取 access_token 失败');
  return data.access_token;
}

function localPathFor(source, baseDir) {
  if (source.startsWith('file:')) return fileURLToPath(source);
  return isAbsolute(source) ? source : resolve(baseDir, source);
}

async function imageBlob(source, baseDir) {
  if (/^data:/i.test(source)) throw new Error('不支持 data URL 图片，请先保存为本地图片文件');
  if (/^https?:\/\//i.test(source)) {
    const response = await fetchChecked(source, { headers: { 'user-agent': 'Mozilla/5.0 WeChatArticlePublisher/1.0' } });
    const bytes = await response.arrayBuffer();
    const url = new URL(source);
    const filename = basename(url.pathname) || 'remote-image.jpg';
    const mime = response.headers.get('content-type')?.split(';')[0] || mimeFor(filename);
    return { blob: new Blob([bytes], { type: mime }), filename };
  }

  const path = localPathFor(source, baseDir);
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`图片不存在: ${path}`);
  const bytes = readFileSync(path);
  return { blob: new Blob([bytes], { type: mimeFor(path) }), filename: basename(path) };
}

async function uploadMultipart(token, endpoint, source, baseDir, extraQuery = {}) {
  const { blob, filename } = await imageBlob(source, baseDir);
  const form = new FormData();
  form.append('media', blob, filename);
  const query = new URLSearchParams({ access_token: token, ...extraQuery });
  return jsonChecked(`${API_ROOT}/${endpoint}?${query.toString()}`, {
    method: 'POST',
    body: form,
  });
}

async function uploadArticleImage(token, source, baseDir) {
  const data = await uploadMultipart(token, 'media/uploadimg', source, baseDir);
  if (!data.url) throw new Error(`正文图片上传失败: ${source}`);
  return data.url;
}

async function uploadCover(token, source, baseDir) {
  const data = await uploadMultipart(token, 'material/add_material', source, baseDir, { type: 'image' });
  if (!data.media_id) throw new Error(`封面图片上传失败: ${source}`);
  return data.media_id;
}

function imageSources(html) {
  return [...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)].map((match) => decodeHtmlAttribute(match[2]));
}

async function uploadAndReplaceImages(token, html, baseDir) {
  const regex = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  const matches = [...html.matchAll(regex)];
  let cursor = 0;
  const chunks = [];

  for (const match of matches) {
    chunks.push(html.slice(cursor, match.index));
    const originalTag = match[0];
    const rawSource = match[2];
    const source = decodeHtmlAttribute(rawSource);
    if (/^https?:\/\/mmbiz\.qpic\.cn/i.test(source)) {
      chunks.push(originalTag);
    } else {
      const uploaded = await uploadArticleImage(token, source, baseDir);
      chunks.push(originalTag.replace(rawSource, uploaded));
    }
    cursor = match.index + originalTag.length;
  }

  chunks.push(html.slice(cursor));
  return chunks.join('');
}

function validateLocalImages(sources, baseDir) {
  const missing = [];
  for (const source of sources) {
    if (/^data:/i.test(source)) throw new Error('不支持 data URL 图片，请先保存为本地图片文件');
    if (/^https?:/i.test(source)) continue;
    const path = localPathFor(source, baseDir);
    if (!existsSync(path) || !statSync(path).isFile()) missing.push(path);
  }
  if (missing.length) throw new Error(`以下正文图片不存在: ${missing.join(', ')}`);
}

function integerOption(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || ![0, 1].includes(parsed)) throw new Error(`选项值必须为 0 或 1: ${value}`);
  return parsed;
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (!['draft', 'update'].includes(command)) fail(usage());

try {
  const title = String(args.title || '').trim();
  const htmlFile = args['html-file'] ? resolve(args['html-file']) : '';
  const coverImage = String(args['cover-image'] || '');
  if (!title) throw new Error('必须指定 --title');
  if (!htmlFile || !existsSync(htmlFile)) throw new Error(`HTML 文件不存在: ${htmlFile || '(空)'}`);
  if (!coverImage) throw new Error('必须指定 --cover-image');
  if (command === 'update' && !args['media-id']) throw new Error('更新草稿必须指定 --media-id');

  const baseDir = dirname(htmlFile);
  const html = readFileSync(htmlFile, 'utf8');
  const sources = imageSources(html);
  validateLocalImages(sources, baseDir);
  if (!/^https?:\/\//i.test(coverImage)) {
    const coverPath = localPathFor(coverImage, baseDir);
    if (!existsSync(coverPath) || !statSync(coverPath).isFile()) throw new Error(`封面图片不存在: ${coverPath}`);
  }

  const summary = {
    success: true,
    dryRun: Boolean(args['dry-run']),
    action: command === 'draft' ? 'create-draft' : 'update-draft',
    title,
    author: args.author || '',
    digest: args.digest || '',
    htmlFile,
    coverImage,
    bodyImageCount: sources.length,
    mediaId: command === 'update' ? args['media-id'] : undefined,
  };

  if (args['dry-run']) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exit(0);
  }

  const { appId, appSecret } = credentials();
  const token = await getAccessToken(appId, appSecret);
  const uploadedHtml = await uploadAndReplaceImages(token, html, baseDir);
  const thumbMediaId = await uploadCover(token, coverImage, baseDir);
  const article = {
    title,
    content: uploadedHtml,
    thumb_media_id: thumbMediaId,
    show_cover_pic: integerOption(args['show-cover-pic'], 0),
    need_open_comment: integerOption(args['need-open-comment'], 0),
    only_fans_can_comment: integerOption(args['only-fans-can-comment'], 0),
  };
  if (args.author) article.author = args.author;
  if (args.digest) article.digest = args.digest;
  if (args['source-url']) article.content_source_url = args['source-url'];

  let result;
  if (command === 'draft') {
    result = await jsonChecked(`${API_ROOT}/draft/add?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ articles: [article] }),
    });
    if (!result.media_id) throw new Error('创建草稿失败：微信接口未返回 media_id');
  } else {
    result = await jsonChecked(`${API_ROOT}/draft/update?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ media_id: args['media-id'], index: 0, articles: article }),
    });
  }

  process.stdout.write(`${JSON.stringify({
    ...summary,
    dryRun: false,
    mediaId: command === 'draft' ? result.media_id : args['media-id'],
    wechat: result,
  }, null, 2)}\n`);
} catch (error) {
  fail(error.message);
}
