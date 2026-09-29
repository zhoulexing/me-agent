"use strict";

const { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const DEFAULT_WORKSPACE = resolve(__dirname, "../..");
const INDEX_HEADER = `# 信息记录索引\n\n按日期倒序。每条索引只保留标题、类型、标签和一句摘要；日期文件保存原文、来源与细节。\n`;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error(`未知参数: ${token}`);
    const key = token.slice(2);
    if (key === "dry-run") flags[key] = true;
    else flags[key] = argv[++i];
    if (flags[key] === undefined) throw new Error(`缺少参数: ${token}`);
  }
  return flags;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shanghaiToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addIndexEntry(index, date, title, type, tags, summary) {
  const month = date.slice(0, 7);
  const bullet = `- **${title}**｜${type}｜${tags.map((tag) => `#${tag}`).join(" ")}｜${summary}\n`;
  const dayHeader = `### [${date}](./${date}.md)`;
  const lines = index.split("\n");
  const dayIndex = lines.findIndex((line) => line === dayHeader);
  if (dayIndex >= 0) {
    let end = dayIndex + 1;
    while (end < lines.length && !/^#{2,3} /.test(lines[end])) end += 1;
    while (end > dayIndex + 1 && lines[end - 1] === "") end -= 1;
    lines.splice(end, 0, bullet.trimEnd());
    return `${lines.join("\n").replace(/\n*$/, "\n")}`;
  }

  const monthHeader = `## ${month}`;
  const monthIndex = lines.findIndex((line) => line === monthHeader);
  const dayBlock = [dayHeader, `概览：${summary}`, "", bullet.trimEnd(), ""];
  if (monthIndex >= 0) {
    let insertion = monthIndex + 1;
    while (insertion < lines.length) {
      const candidate = lines[insertion].match(/^### \[(\d{4}-\d{2}-\d{2})\]/);
      if (candidate && candidate[1] < date) break;
      if (lines[insertion].startsWith("## ")) break;
      insertion += 1;
    }
    lines.splice(insertion, 0, ...dayBlock);
  } else {
    let insertion = lines.findIndex((line) => /^## \d{4}-\d{2}$/.test(line) && line.slice(3) < month);
    if (insertion < 0) insertion = lines.length;
    lines.splice(insertion, 0, monthHeader, "", ...dayBlock);
  }
  return `${lines.join("\n").replace(/\n*$/, "\n")}`;
}

function add(argv) {
  if (argv.includes("--help")) {
    console.log("用法: zlx-cli record add --title <标题> --type <类型> --tags <标签1,标签2> --summary <不超过60字的摘要> --content-file <原文文件> [--date YYYY-MM-DD] [--source <URL>] [--workspace <目录>] [--dry-run]");
    return 0;
  }
  const flags = parseFlags(argv);
  const date = flags.date || shanghaiToday();
  if (!validDate(date)) throw new Error(`无效日期: ${date}`);
  const title = String(flags.title || "").trim();
  const type = String(flags.type || "").trim();
  const summary = String(flags.summary || "").trim();
  const tags = String(flags.tags || "").split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
  if (!title || !type || !summary || !flags["content-file"] || !tags.length)
    throw new Error("必须指定标题、类型、标签、摘要和原文文件");
  if (summary.length > 60) throw new Error("摘要不能超过 60 字");
  if (/[\r\n|]/.test(title + type + summary) || tags.some((tag) => /[\s#|]/.test(tag)))
    throw new Error("标题、类型、标签和摘要只能是一行，且不能包含索引分隔符");
  const source = String(flags.source || "").trim();
  if (source && !/^https?:\/\//.test(source)) throw new Error("来源链接需为 HTTP(S) URL");
  const content = readFileSync(resolve(flags["content-file"]), "utf8").trim();
  if (!content) throw new Error("原文文件为空");
  const workspace = resolve(flags.workspace || DEFAULT_WORKSPACE);
  const recordsDir = join(workspace, "03-信息记录");
  if (!existsSync(recordsDir)) throw new Error(`信息记录目录不存在: ${recordsDir}`);
  const dayPath = join(recordsDir, `${date}.md`);
  const indexPath = join(recordsDir, "索引.md");
  const current = existsSync(dayPath) ? readFileSync(dayPath, "utf8") : `# ${date}\n`;
  const ids = [...current.matchAll(new RegExp(`^## ${date.replaceAll("-", "")}-([0-9]+)\\b`, "gm"))].map((match) => Number(match[1]));
  const id = String(Math.max(0, ...ids) + 1).padStart(2, "0");
  const heading = `${date.replaceAll("-", "")}-${id} ${title}`;
  if (current.includes(` ${title}\n`)) throw new Error(`当天已有同名条目: ${title}`);
  const entry = `\n## ${heading}\n- 类型：${type}\n- 标签：${tags.join("、")}\n${source ? `- 来源链接：${source}\n` : ""}- 原始内容：\n\n${content}\n`;
  const index = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : INDEX_HEADER;
  const updatedIndex = addIndexEntry(index, date, title, type, tags, summary);
  const result = { date, heading, dayPath, indexPath, dryRun: Boolean(flags["dry-run"]) };
  if (flags["dry-run"]) {
    console.log(JSON.stringify({ ...result, entry, indexEntry: `${title}｜${type}｜${tags.join(",")}｜${summary}` }, null, 2));
    return 0;
  }
  mkdirSync(recordsDir, { recursive: true });
  if (!existsSync(dayPath)) writeFileSync(dayPath, `# ${date}\n`, { flag: "wx" });
  appendFileSync(dayPath, entry, "utf8");
  writeFileSync(indexPath, updatedIndex, "utf8");
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

function search(argv) {
  if (argv.includes("--help")) {
    console.log("用法: zlx-cli record search <关键词> [--workspace <目录>]");
    return 0;
  }
  const query = argv.shift();
  if (!query) throw new Error("请提供检索关键词");
  const flags = parseFlags(argv);
  const workspace = resolve(flags.workspace || DEFAULT_WORKSPACE);
  const indexPath = join(workspace, "03-信息记录", "索引.md");
  const matches = existsSync(indexPath)
    ? readFileSync(indexPath, "utf8").split("\n").filter((line) => line.toLowerCase().includes(query.toLowerCase()))
    : [];
  console.log(JSON.stringify({ query, indexPath, matches }, null, 2));
  return 0;
}

try {
  const [action, ...argv] = process.argv.slice(2);
  process.exitCode = action === "add" ? add(argv) : action === "search" ? search(argv) : 2;
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
