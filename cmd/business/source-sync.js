"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { createGetnoteSource } = require("../platforms/getnote/source");

const ROOT = path.resolve(__dirname, "../..");
const RENDER_VERSION = 2;
const INDEX_HEADER = "# 信息记录索引\n\n按日期倒序。索引用于检索，日期文件保存原文。\n";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
const fileHash = (file) => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
const json = (value) => JSON.stringify(value, null, 2) + "\n";

function canonical(value, key = "") {
  if (Array.isArray(value)) return value.map((item) => canonical(item));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name], name)]));
  // Expiring access signatures are not edits to the source note.
  if (typeof value === "string" && /^(url|original_url|play_url)$/.test(key) && value.startsWith("https://")) {
    const url = new URL(value);
    for (const name of ["Expires", "Signature", "OSSAccessKeyId", "x-oss-signature", "x-oss-credential", "x-oss-date", "x-oss-expires"])
      url.searchParams.delete(name);
    return url.toString();
  }
  return value;
}
const fingerprint = (value) => hash(JSON.stringify(canonical(value)));

function sourceDate(value) {
  if (typeof value !== "string") throw new Error("源创建时间缺失");
  let date;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) date = value.slice(0, 10);
  else {
    const time = new Date(value);
    if (Number.isNaN(time.getTime())) throw new Error("源时间格式无法识别");
    date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(time);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)
    throw new Error("源日期无效");
  return date;
}

function markers(source, id, kind) {
  return [`<!-- SOURCE_SYNC ${source} ${id} ${kind} START -->`, `<!-- SOURCE_SYNC ${source} ${id} ${kind} END -->`];
}
function locate(text, source, id, kind) {
  const [start, end] = markers(source, id, kind);
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 && b < 0) return null;
  if (a < 0 || b < a || text.indexOf(start, a + start.length) >= 0 || text.indexOf(end, b + end.length) >= 0)
    throw new Error(`同步区块标记损坏：${id}`);
  return { start: a, end: b + end.length, text: text.slice(a, b + end.length) };
}
function wrap(source, id, kind, body) {
  const [start, end] = markers(source, id, kind);
  if (body.includes(start) || body.includes(end)) throw new Error("源正文与同步标记冲突");
  return `${start}\n${body}\n${end}`;
}
function replace(text, block, value) {
  return text.slice(0, block.start) + value + text.slice(block.end);
}

function renderNote(source, note, sequence) {
  const id = note.note_id, date = sourceDate(note.created_at);
  const title = note.title || "源标题为空";
  const tags = (note.tags || []).map((tag) => `${tag.name}（${tag.type ?? ""}）`).join("、") || "[]";
  const metadata = [["同步来源", "Get 笔记"], ["原始 ID", id], ["源笔记类型", note.note_type],
    ["源字段 source", note.source], ["源字段 entry_type", note.entry_type], ["源创建时间", note.created_at],
    ["源更新时间", note.updated_at], ["源版本", note.version], ["源标签", tags], ["源知识库", JSON.stringify(note.topics ?? [])]];
  let body = `## ${date.replaceAll("-", "")}-${String(sequence).padStart(2, "0")} ${title}\n\n`;
  body += metadata.map(([label, value]) => `- ${label}：${value ?? "接口未提供"}`).join("\n");
  body += "\n";
  if (note.web_page?.url) body += `- 源网页链接：[${note.web_page.url}](${note.web_page.url})\n`;
  if (note.content !== null && note.content !== undefined && note.content !== "") {
    if (typeof note.content !== "string") throw new Error("源文本字段类型变化：content");
    body += `\n### Get 正文\n\n${wrap(source, id, "content", note.content)}\n`;
  }
  return wrap(source, id, "NOTE", body);
}

function indexEntry(note) {
  let excerpt = note.content || "";
  excerpt = excerpt.replace(/^\s*(?:#{1,6}|>)\s*/gm, "").replaceAll("**", "").replaceAll("`", "").replace(/\s+/g, " ");
  const chars = [...excerpt];
  excerpt = chars.length > 60 ? chars.slice(0, 59).join("") + "…" : excerpt;
  const tags = (note.tags || []).map((tag) => "#" + tag.name).join(" ") || `#Get笔记 #${note.note_type}（系统索引标签；源标签为空）`;
  const title = (note.title || "源标题为空").replaceAll("[", "\\[").replaceAll("]", "\\]").replace(/\r?\n/g, " ");
  const date = sourceDate(note.created_at);
  return `- **[${title}](./${date}.md)**｜${note.note_type}｜${tags}｜正文开头摘录：${excerpt}`;
}

function appendIndexDay(index, date, block) {
  const dayHeader = `### [${date}](./${date}.md)`, monthHeader = `## ${date.slice(0, 7)}`;
  const lines = index.split("\n");
  const existingDay = lines.indexOf(dayHeader);
  if (existingDay >= 0) {
    let end = existingDay + 1;
    while (end < lines.length && !/^#{2,3} /.test(lines[end])) end += 1;
    lines.splice(end, 0, "", block, "");
  } else {
    let month = lines.indexOf(monthHeader);
    if (month < 0) {
      // Month/date ordering is descending.
      month = lines.findIndex((line) => /^## \d{4}-\d{2}$/.test(line) && line < monthHeader);
      if (month < 0) month = lines.length;
      lines.splice(month, 0, monthHeader, "");
    }
    let end = month + 1;
    while (end < lines.length) {
      const match = lines[end].match(/^### \[(\d{4}-\d{2}-\d{2})\]/);
      if (lines[end].startsWith("## ") || (match && match[1] < date)) break;
      end += 1;
    }
    lines.splice(end, 0, dayHeader, "", `概览：Get 笔记原文同步。`, "", block, "");
  }
  return lines.join("\n");
}

function safeTarget(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || !/^(03-信息记录\/|outputs\/信息同步\/|\.zlx-cli\/source-sync\/)/.test(relative))
    throw new Error("同步事务目标超出允许目录");
  return target;
}
function atomicWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.sync-${randomUUID()}`;
  try { fs.writeFileSync(temp, bytes, { mode: 0o600 }); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function recover(root, runtime, dryRun, beforeWrite) {
  const pendingPath = path.join(runtime, "pending.json"), pending = read(pendingPath);
  if (!pending) return null;
  if (dryRun) throw new Error("存在待恢复同步事务；请先运行正常同步恢复");
  const tx = JSON.parse(pending);
  const stage = path.resolve(root, tx.stage);
  if (!stage.startsWith(runtime + path.sep + "staging" + path.sep)) throw new Error("同步暂存路径无效");
  // Preflight all files so a manual edit is detected before resuming any writes.
  for (const op of tx.operations) {
    const current = fileHash(safeTarget(root, op.target));
    if (current !== op.before && current !== op.after) throw new Error(`检测到本地修改，保留同步事务并停止：${op.target}`);
    if (fileHash(path.join(stage, op.file)) !== op.after) throw new Error("同步暂存文件缺失或损坏");
  }
  for (const [position, op] of tx.operations.entries()) {
    const target = safeTarget(root, op.target), current = fileHash(target);
    if (current === op.after) continue;
    if (current !== op.before) throw new Error(`写入期间检测到本地修改：${op.target}`);
    if (beforeWrite) beforeWrite(op.target, position);
    atomicWrite(target, fs.readFileSync(path.join(stage, op.file)));
    if (fileHash(target) !== op.after) throw new Error(`写入后核验失败：${op.target}`);
  }
  fs.unlinkSync(pendingPath);
  fs.rmSync(stage, { recursive: true, force: true });
  return tx.receipt;
}

function acquire(runtime) {
  fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
  const lock = path.join(runtime, "lock.json");
  try { fs.writeFileSync(lock, json({ pid: process.pid }), { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const prior = JSON.parse(fs.readFileSync(lock, "utf8"));
    try { process.kill(prior.pid, 0); } catch (probe) {
      if (probe.code !== "ESRCH") throw new Error("另一同步进程仍在运行");
      fs.unlinkSync(lock);
      return acquire(runtime);
    }
    throw new Error("另一同步进程仍在运行");
  }
  return () => fs.unlinkSync(lock);
}

async function syncSource({ workspace = ROOT, adapter, startDate, dryRun = false, now = new Date(), beforeWrite } = {}) {
  workspace = path.resolve(workspace);
  if (!fs.existsSync(path.join(workspace, "03-信息记录"))) throw new Error("信息记录目录不存在");
  const runtime = path.join(workspace, ".zlx-cli/source-sync"), unlock = acquire(runtime);
  let staged;
  try {
    const recovered = recover(workspace, runtime, dryRun, beforeWrite);
    const source = adapter || createGetnoteSource(), name = source.name;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error("来源名称无效");
    const statePath = path.join(runtime, name + ".json");
    const previous = read(statePath);
    const state = previous ? JSON.parse(previous) : { version: 1, startDate, identity: source.identity, notes: {}, indexHashes: {} };
    if (state.version !== 1 || state.identity !== source.identity) throw new Error("同步凭证或状态版本变化，请先核对账号，不能混用进度");
    startDate = state.startDate || startDate;
    sourceDate(startDate + " 00:00:00");
    const listing = await source.list();
    const eligible = listing.notes.filter((note) => sourceDate(note.created_at) >= startDate || state.notes[note.note_id]);
    eligible.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.note_id.localeCompare(b.note_id));
    const recentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date(now.getTime() - 3 * 86400000));
    const changes = [], next = structuredClone(state);
    let detailsRead = 0;
    for (const listed of eligible) {
      const prior = state.notes[listed.note_id], listHash = fingerprint(listed);
      if (prior?.renderVersion === RENDER_VERSION && prior.listHash === listHash && sourceDate(listed.created_at) < recentDate) continue;
      const detail = await source.detail(listed.note_id);
      detailsRead += 1;
      const materialHash = fingerprint(detail.note);
      // Only template fields affect the local record; hidden fields and signed
      // attachment URLs can change even when the displayed content does not.
      if (prior?.renderVersion === RENDER_VERSION && hash(renderNote(name, detail.note, prior.sequence)) === prior.blockHash) {
        next.notes[listed.note_id].listHash = listHash;
        continue;
      }
      sourceDate(detail.note.created_at);
      changes.push({ listed, listHash, materialHash, layoutOnly: prior?.materialHash === materialHash, ...detail });
    }
    const docs = new Map(), baselines = new Map(), files = new Map(), changedDates = new Set();
    const stageFile = (relative, bytes) => {
      const target = safeTarget(workspace, relative);
      if (!baselines.has(relative)) baselines.set(relative, fileHash(target));
      files.set(relative, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
    };
    function day(date) {
      const relative = `03-信息记录/${date}.md`;
      if (!docs.has(date)) {
        const target = safeTarget(workspace, relative);
        baselines.set(relative, fileHash(target));
        docs.set(date, read(target) ?? `# ${date}\n`);
      }
      return docs.get(date);
    }
    let added = 0, updated = 0;
    for (const change of changes) {
      const note = change.note, id = note.note_id, prior = state.notes[id], date = sourceDate(note.created_at);
      if (prior) {
        const old = locate(day(prior.date), name, id, "NOTE");
        if (!old || hash(old.text) !== prior.blockHash) throw new Error(`源同步区块已被本地修改，保留原文并停止：${id}`);
        if (prior.date !== date) {
          docs.set(prior.date, replace(day(prior.date), old, ""));
          changedDates.add(prior.date);
        }
      }
      const existing = locate(day(date), name, id, "NOTE");
      if (existing && !prior) throw new Error(`发现无同步状态的已有来源区块：${id}`);
      const sequences = [...day(date).matchAll(new RegExp(`^## ${date.replaceAll("-", "")}-([0-9]+)\\b`, "gm"))].map((match) => Number(match[1]));
      const sequence = prior?.date === date ? prior.sequence : Math.max(0, ...sequences) + 1;
      const snapshot = `outputs/信息同步/${name}/${id}/${change.materialHash}`;
      const block = renderNote(name, note, sequence);
      docs.set(date, existing ? replace(day(date), existing, block) : day(date) + "\n" + block + "\n");
      changedDates.add(date);
      if (!change.layoutOnly) {
        stageFile(`${snapshot}/raw.json`, change.raw);
        stageFile(`${snapshot}/manifest.json`, json({ source: name, note_id: id, fetched_at: now.toISOString(), fields: ["content"] }));
      }
      next.notes[id] = { date, sequence, createdAt: note.created_at, listHash: change.listHash, materialHash: change.materialHash,
        blockHash: hash(block), indexEntry: indexEntry(note), snapshot, renderVersion: RENDER_VERSION };
      if (prior) updated += 1; else added += 1;
    }
    const indexRelative = "03-信息记录/索引.md";
    let index = read(path.join(workspace, indexRelative)) ?? INDEX_HEADER;
    baselines.set(indexRelative, fileHash(path.join(workspace, indexRelative)));
    for (const date of [...changedDates].sort()) {
      const old = locate(index, name, date, "INDEX");
      const priorHash = state.indexHashes[date];
      if ((old && (!priorHash || hash(old.text) !== priorHash)) || (!old && priorHash))
        throw new Error(`来源索引区块已被本地修改：${date}`);
      const rows = Object.values(next.notes).filter((note) => note.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const block = wrap(name, date, "INDEX", `\n同步概览：${rows.length} 条 Get 笔记原文记录。\n\n${rows.map((note) => note.indexEntry).join("\n")}\n`);
      index = old ? replace(index, old, block) : appendIndexDay(index, date, block);
      next.indexHashes[date] = hash(block);
      stageFile(`03-信息记录/${date}.md`, docs.get(date));
    }
    if (changedDates.size) stageFile(indexRelative, index);
    // Verify field fidelity from the rendered records before committing anything.
    for (const { note } of changes) {
      const saved = docs.get(sourceDate(note.created_at));
      for (const [field, value] of [["content", note.content]]) {
        if (typeof value !== "string" || !value) continue;
        const block = locate(saved, name, note.note_id, field);
        const [a, b] = markers(name, note.note_id, field);
        if (!block || block.text !== `${a}\n${value}\n${b}`) throw new Error(`原文字段核验失败：${field}`);
      }
    }
    const receipt = { status: changes.length ? (dryRun ? "preview" : "synced") : "skipped", source: name, startDate,
      pages: listing.pages, listed: listing.total, eligible: eligible.length, detailsRead, added, updated,
      files: [...changedDates].sort().map((date) => path.join(workspace, "03-信息记录", date + ".md")) };
    if (dryRun) return { ...receipt, recovered: false };
    next.lastSuccess = now.toISOString();
    stageFile(path.relative(workspace, statePath), json(next)); // Progress is the final operation.
    staged = path.join(runtime, "staging", randomUUID());
    fs.mkdirSync(staged, { recursive: true, mode: 0o700 });
    const operations = [];
    for (const [target, bytes] of files) {
      const after = hash(bytes), before = baselines.get(target);
      if (before === after) continue;
      const file = String(operations.length);
      fs.writeFileSync(path.join(staged, file), bytes, { mode: 0o600 });
      operations.push({ target, before, after, file });
    }
    for (const op of operations) if (fileHash(safeTarget(workspace, op.target)) !== op.before)
      throw new Error(`提交前检测到本地修改：${op.target}`);
    atomicWrite(path.join(runtime, "pending.json"), json({ version: 1, stage: path.relative(workspace, staged), operations, receipt }));
    recover(workspace, runtime, false, beforeWrite);
    if (recovered) return { ...receipt, status: "synced", recovered: true, added: added + recovered.added, updated: updated + recovered.updated,
      files: [...new Set([...recovered.files, ...receipt.files])] };
    return { ...receipt, recovered: false };
  } finally {
    if (staged && !fs.existsSync(path.join(runtime, "pending.json"))) fs.rmSync(staged, { recursive: true, force: true });
    unlock();
  }
}

async function main(argv) {
  if (argv.includes("--help")) {
    console.log("用法: zlx-cli record sync [--source getnote|all] [--dry-run] [--workspace <目录>]\n配置: .config/source-sync.json；无新增或修改时不改信息记录。");
    return;
  }
  const options = { source: "all" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") options.dryRun = true;
    else if (["--source", "--workspace"].includes(argv[i]) && argv[i + 1]) options[argv[i].slice(2)] = argv[++i];
    else throw new Error(`未知或缺少参数：${argv[i]}`);
  }
  const workspace = path.resolve(options.workspace || ROOT);
  const config = JSON.parse(fs.readFileSync(path.join(workspace, ".config/source-sync.json"), "utf8"));
  if (config.version !== 1 || config.timezone !== "Asia/Shanghai" || !Array.isArray(config.sources)) throw new Error("同步配置无效");
  sourceDate(config.startDate + " 00:00:00");
  const sources = options.source === "all" ? config.sources : [options.source];
  if (!sources.length || sources.some((source) => source !== "getnote" || !config.sources.includes(source))) throw new Error("尚未配置此同步来源");
  const results = [];
  for (const source of sources) results.push(await syncSource({ workspace, startDate: config.startDate, dryRun: options.dryRun, adapter: createGetnoteSource() }));
  console.log(json({ status: results.every((result) => result.status === "skipped") ? "skipped" : options.dryRun ? "preview" : "synced", results }));
}

module.exports = { syncSource, renderNote, sourceDate, fingerprint };
if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
