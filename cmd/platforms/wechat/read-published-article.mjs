#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentials } from '../../auth/wechat.mjs';

const API_ROOT = 'https://api.weixin.qq.com/cgi-bin';
const PAGE_SIZE = 20;

function usage() {
  return `用法:
  zlx-cli wechat read-published --url <公众号文章链接> [--title <准确标题>] [--max-pages 10] [--output <JSON文件>]
  zlx-cli wechat read-published --article-id <ARTICLE_ID> [--output <JSON文件>]

只查询当前 .config/wechat.json 对应账号的已发布图文。短链接与接口返回的 URL
可能不同；此时 --title 只能定位候选，结果会标记为 title-only。`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { help: true };
    if (!['--url', '--title', '--article-id', '--max-pages', '--output', '--config'].includes(key)) {
      throw new Error(`未知参数: ${key}`);
    }
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${key} 缺少值`);
    args[key.slice(2)] = argv[++i];
  }
  return args;
}

export function normalizedArticleUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'mp.weixin.qq.com') return '';
    url.hash = '';
    url.searchParams.sort();
    return `${url.hostname}${url.pathname.replace(/\/$/, '')}${url.search}`;
  } catch {
    return '';
  }
}

export function selectArticle(items, requestedUrl) {
  const target = normalizedArticleUrl(requestedUrl);
  for (const item of items) {
    for (const article of item.content?.news_item || []) {
      if (target && normalizedArticleUrl(article.url) === target) {
        return { item, article, matchedBy: 'url' };
      }
    }
  }
  return null;
}

export function titleCandidates(items, title) {
  if (!title) return [];
  return items.flatMap(item => (item.content?.news_item || [])
    .filter(article => article.title === title)
    .map(article => ({ item, article, matchedBy: 'title-only' })));
}

async function apiJson(path, token, body) {
  const url = new URL(`${API_ROOT}${path}`);
  if (token) url.searchParams.set('access_token', token);
  else {
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', body.appId);
    url.searchParams.set('secret', body.appSecret);
  }
  let response;
  try {
    response = await fetch(url, {
      method: token ? 'POST' : 'GET',
      headers: token ? { 'content-type': 'application/json; charset=utf-8' } : {},
      body: token ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(`网络请求失败: ${error.cause?.code || error.name}`);
  }
  if (!response.ok) throw new Error(`微信接口 HTTP ${response.status}`);
  let data;
  try { data = await response.json(); }
  catch { throw new Error('微信接口返回的不是 JSON'); }
  if (data.errcode && data.errcode !== 0) {
    if (data.errcode === 40164) throw new Error(`40164 (${path})：当前出口 IP 不在公众号白名单；${data.errmsg || ''}`);
    if (data.errcode === 48001) throw new Error(`48001 (${path})：当前公众号没有此接口权限；${data.errmsg || ''}`);
    throw new Error(`微信接口错误 ${data.errcode} (${path}): ${data.errmsg || ''}`);
  }
  return data;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) { console.log(usage()); return; }
  if (!args.url && !args['article-id']) throw new Error(usage());
  if (args.url && args['article-id']) throw new Error('--url 和 --article-id 只能选一个');
  if (args.url && !normalizedArticleUrl(args.url)) throw new Error('--url 必须是 mp.weixin.qq.com 的文章链接');
  const maxPages = Number(args['max-pages'] || 10);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 500) {
    throw new Error('--max-pages 必须是 1 到 500 的整数');
  }

  const { appId, appSecret } = credentials(args.config || '');
  const tokenResponse = await apiJson('/token', '', { appId, appSecret });
  const token = tokenResponse.access_token;
  if (!token) throw new Error('微信未返回 access_token');

  let selected;
  let scanned = 0;
  if (args['article-id']) {
    selected = { item: { article_id: args['article-id'] }, matchedBy: 'article-id' };
  } else {
    const candidates = [];
    for (let page = 0; page < maxPages; page += 1) {
      const data = await apiJson('/freepublish/batchget', token, {
        offset: page * PAGE_SIZE, count: PAGE_SIZE, no_content: 0,
      });
      const items = Array.isArray(data.item) ? data.item : [];
      scanned += items.length;
      selected = selectArticle(items, args.url);
      if (selected) break;
      candidates.push(...titleCandidates(items, args.title));
      if (items.length < PAGE_SIZE || scanned >= data.total_count) break;
    }
    if (!selected && candidates.length > 1) {
      throw new Error(`找到 ${candidates.length} 篇同名文章；请改用 --article-id`);
    }
    if (!selected) selected = candidates[0];
  }

  if (!selected) {
    console.log(JSON.stringify({ found: false, scanned, requestedUrl: args.url,
      message: '当前账号的已发布列表中未找到匹配文章；请核对账号、标题，或增大 --max-pages。' }, null, 2));
    return;
  }

  const detail = await apiJson('/freepublish/getarticle', token, {
    article_id: selected.item.article_id,
  });
  const articles = Array.isArray(detail.news_item) ? detail.news_item : [];
  if (!articles.length) throw new Error('图文详情接口未返回文章内容');
  const matchedBy = selected.matchedBy === 'title-only' && articles.some(article =>
    normalizedArticleUrl(article.url) === normalizedArticleUrl(args.url)) ? 'url' : selected.matchedBy;
  const result = {
    found: true,
    matchedBy,
    requestedUrl: args.url || undefined,
    articleId: selected.item.article_id,
    scanned,
    articles,
  };
  if (args.output) {
    const path = resolve(args.output);
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ found: true, matchedBy: result.matchedBy,
      articleId: result.articleId, titles: articles.map(article => article.title), output: path }, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  });
}
