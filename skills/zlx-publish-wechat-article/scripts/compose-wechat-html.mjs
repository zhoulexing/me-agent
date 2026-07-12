#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

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

function fail(message) {
  process.stderr.write(`${JSON.stringify({ success: false, error: message }, null, 2)}\n`);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, '<img src="$2" alt="$1" style="display:block;width:100%;height:auto;margin:22px auto;border-radius:6px;" />');
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" style="color:#576b95;text-decoration:none;">$1</a>');
  text = text.replace(/`([^`]+)`/g, '<code style="padding:2px 5px;border-radius:4px;background:#f5f5f5;color:#d14;font-size:0.9em;">$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return text;
}

function splitBlocks(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const blocks = [];
  let current = [];
  let inFence = false;

  function flush() {
    if (current.length) blocks.push(current);
    current = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      current.push(line);
      inFence = !inFence;
      if (!inFence) flush();
      continue;
    }
    if (!inFence && line.trim() === '') flush();
    else current.push(line);
  }
  flush();
  return blocks;
}

const paragraphStyle = 'margin:0 0 18px;color:#2b2b2b;font-size:16px;line-height:1.9;letter-spacing:0.02em;text-align:justify;word-break:break-word;';
const headingStyle = 'margin:34px 0 18px;padding-left:12px;border-left:4px solid #1f6f5f;color:#1f2933;font-size:22px;line-height:1.45;font-weight:700;';

function renderBlock(lines) {
  const first = lines[0] || '';
  const joined = lines.join('\n');

  if (first.trim().startsWith('```') && lines.at(-1)?.trim().startsWith('```')) {
    const language = first.trim().slice(3).trim();
    const code = lines.slice(1, -1).join('\n');
    return `<pre style="margin:20px 0;padding:16px;overflow:auto;border-radius:8px;background:#f6f8fa;color:#24292f;font-size:14px;line-height:1.65;"><code data-language="${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
  }

  const heading = first.match(/^(#{1,6})\s+(.+)$/);
  if (heading && lines.length === 1) {
    return `<h2 style="${headingStyle}">${inlineMarkdown(heading[2])}</h2>`;
  }

  if (/^\s*(?:[-*_]\s*){3,}$/.test(first) && lines.length === 1) {
    return '<hr style="margin:30px auto;border:0;border-top:1px solid #e5e7eb;" />';
  }

  if (lines.every((line) => /^\s*>\s?/.test(line))) {
    const body = lines.map((line) => inlineMarkdown(line.replace(/^\s*>\s?/, ''))).join('<br>');
    return `<blockquote style="margin:22px 0;padding:14px 18px;border-left:4px solid #c8d8d3;background:#f5f8f7;color:#5b6573;font-size:16px;line-height:1.8;">${body}</blockquote>`;
  }

  if (lines.every((line) => /^\s*[-+*]\s+/.test(line))) {
    const items = lines.map((line) => `<li style="margin:8px 0;">${inlineMarkdown(line.replace(/^\s*[-+*]\s+/, ''))}</li>`).join('');
    return `<ul style="margin:0 0 20px;padding-left:1.4em;color:#2b2b2b;font-size:16px;line-height:1.8;">${items}</ul>`;
  }

  if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
    const items = lines.map((line) => `<li style="margin:8px 0;">${inlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('');
    return `<ol style="margin:0 0 20px;padding-left:1.4em;color:#2b2b2b;font-size:16px;line-height:1.8;">${items}</ol>`;
  }

  if (/^\s*<[^>]+>/.test(first) && /<\/[^>]+>\s*$/.test(lines.at(-1) || '')) return joined;

  return `<p style="${paragraphStyle}">${lines.map(inlineMarkdown).join('<br>')}</p>`;
}

function resolveImage(image, planDir) {
  if (!image || /^(?:https?:|data:|file:)/i.test(image)) return image;
  return isAbsolute(image) ? image : resolve(planDir, image);
}

function renderInsertion(insertion, planDir) {
  const parts = [];
  if (insertion.heading) {
    parts.push(`<h2 data-zlx-inserted="true" style="${headingStyle}">${escapeHtml(insertion.heading)}</h2>`);
  }
  if (insertion.image) {
    const src = resolveImage(insertion.image, planDir);
    const caption = insertion.caption
      ? `<figcaption style="margin-top:8px;color:#8a8f98;font-size:13px;line-height:1.6;text-align:center;">${escapeHtml(insertion.caption)}</figcaption>`
      : '';
    parts.push(`<figure data-zlx-inserted="true" style="margin:18px 0 26px;"><img src="${escapeHtml(src)}" alt="${escapeHtml(insertion.alt || '')}" style="display:block;width:100%;height:auto;margin:0 auto;border-radius:6px;" />${caption}</figure>`);
  }
  return parts.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const input = args.input ? resolve(args.input) : '';
const planPath = args.plan ? resolve(args.plan) : '';
const output = args.output ? resolve(args.output) : '';

if (!input || !planPath || !output) fail('用法: compose-wechat-html.mjs --input <source.md> --plan <layout.json> --output <article.html>');
if (!existsSync(input)) fail(`文章来源不存在: ${input}`);
if (!existsSync(planPath)) fail(`布局计划不存在: ${planPath}`);

try {
  const source = readFileSync(input, 'utf8');
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const blocks = splitBlocks(source);
  const insertions = Array.isArray(plan.insertions) ? plan.insertions : [];
  const byIndex = new Map();

  insertions.forEach((item, order) => {
    if (!Number.isInteger(item.before) || item.before < 0 || item.before > blocks.length) {
      throw new Error(`insertions[${order}].before 必须是 0 到 ${blocks.length} 之间的整数`);
    }
    if (!item.heading && !item.image) throw new Error(`insertions[${order}] 至少需要 heading 或 image`);
    if (!byIndex.has(item.before)) byIndex.set(item.before, []);
    byIndex.get(item.before).push(item);
  });

  const content = [];
  for (let index = 0; index <= blocks.length; index += 1) {
    for (const insertion of byIndex.get(index) || []) content.push(renderInsertion(insertion, dirname(planPath)));
    if (index < blocks.length) content.push(renderBlock(blocks[index]));
  }

  const html = `<section style="box-sizing:border-box;margin:0 auto;max-width:677px;padding:8px 2px;color:#2b2b2b;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Microsoft YaHei',Arial,sans-serif;">\n${content.join('\n')}\n</section>\n`;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html, 'utf8');

  const imageCount = insertions.filter((item) => item.image).length;
  const warnings = imageCount >= 3 && imageCount <= 5 ? [] : [`正文配图数量为 ${imageCount}，建议控制在 3-5 张。`];
  process.stdout.write(`${JSON.stringify({ success: true, input, plan: planPath, output, blockCount: blocks.length, imageCount, warnings }, null, 2)}\n`);
} catch (error) {
  fail(error.message);
}
