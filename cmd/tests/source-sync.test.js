"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { syncSource, sourceDate } = require("../business/source-sync");
const { parseResponse } = require("../platforms/getnote/source");

const NOW = new Date("2026-10-08T15:30:00Z");
function note(id = "1923470895935554712", content = "  \n原文\n\n# 源标题\n**原样**\\n字面量\n ") {
  return { note_id: id, id, title: "同名笔记", content, note_type: "plain_text", source: "app", entry_type: "manual",
    created_at: "2026-10-07 23:50:00", updated_at: "2026-10-07 23:50:00", version: 1, tags: [], topics: [], attachments: [] };
}
function setup(t) {
  const root = fs.mkdtempSync(join(tmpdir(), "me-agent-source-sync-"));
  fs.mkdirSync(join(root, "03-信息记录"));
  fs.writeFileSync(join(root, "03-信息记录/2026-10-07.md"), "# 2026-10-07\n\n## 手工事项\n- [x] 完成的任务\n用户备注，保留尾部空白。  \n");
  fs.writeFileSync(join(root, "03-信息记录/索引.md"), "# 信息记录索引\n\n## 2026-10\n\n### [2026-10-07](./2026-10-07.md)\n概览：原有手工概览。\n\n- **手工事项**｜待办｜#手工 #工作｜保留用户摘要。\n");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function source(notes) {
  return { name: "getnote", identity: "test-account",
    async list() { return { notes: structuredClone(notes), pages: 2, total: notes.length }; },
    async detail(id) { const data = notes.find((n) => n.note_id === id); return { note: structuredClone(data), raw: JSON.stringify({ success: true, data: { note: data } }) }; },
    async asset() { return Buffer.from("original-attachment-bytes"); } };
}
const run = (root, adapter, extra = {}) => syncSource({ workspace: root, adapter, startDate: "2026-10-07", now: NOW, ...extra });
const read = (root, relative) => fs.readFileSync(join(root, relative), "utf8");
function tree(root, relative) {
  const dir = join(root, relative);
  if (!fs.existsSync(dir)) return {};
  const result = {};
  for (const file of fs.readdirSync(dir, { recursive: true })) {
    const target = join(dir, file);
    if (fs.statSync(target).isFile()) result[file] = fs.readFileSync(target).toString("base64");
  }
  return result;
}

test("sync keeps original fields, same-title identities, raw snapshots and manual content; rerun is a no-op", async (t) => {
  const root = setup(t), notes = [note(), note("1923470895935554713", "第二条原文")];
  notes[0].audio = { original: "微修车，错字保留。\n", transcript: "另一份转写。" };
  notes[0].web_page = { url: "https://example.com/article", content: "网页\\n\\n原文", excerpt: "源摘要" };
  const manual = read(root, "03-信息记录/2026-10-07.md"), oldIndex = read(root, "03-信息记录/索引.md");
  const adapter = source(notes), first = await run(root, adapter);
  assert.equal(first.added, 2);
  assert.equal(first.detailsRead, 2);
  assert.deepEqual(first.files, [join(root, "03-信息记录/2026-10-07.md")]);
  const saved = read(root, "03-信息记录/2026-10-07.md");
  assert.ok(saved.startsWith(manual));
  assert.ok(saved.includes(notes[0].content));
  assert.ok(saved.includes(notes[0].audio.original));
  assert.ok(saved.includes(notes[0].web_page.content));
  assert.match(saved, /20261007-01 同名笔记/);
  assert.match(saved, /20261007-02 同名笔记/);
  assert.ok(read(root, "03-信息记录/索引.md").includes(oldIndex.trimEnd()));
  const state = JSON.parse(read(root, ".zlx-cli/source-sync/getnote.json"));
  assert.equal(read(root, state.notes[notes[0].note_id].snapshot + "/raw.json"), (await adapter.detail(notes[0].note_id)).raw);
  const before = tree(root, "03-信息记录"), archives = tree(root, "outputs");
  const second = await run(root, adapter);
  assert.equal(second.status, "skipped");
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.deepEqual(tree(root, "outputs"), archives);
});

test("source update replaces only its own block and keeps previous snapshots", async (t) => {
  const root = setup(t), notes = [note()], adapter = source(notes);
  await run(root, adapter);
  const first = JSON.parse(read(root, ".zlx-cli/source-sync/getnote.json")).notes[notes[0].note_id];
  fs.appendFileSync(join(root, "03-信息记录/2026-10-07.md"), "\n## 新增手工备注\n保留这句话。\n");
  notes[0].content = "新的完整原文。\n";
  notes[0].updated_at = "2026-10-08 12:00:00";
  notes[0].version = 2;
  const result = await run(root, adapter);
  assert.equal(result.updated, 1);
  const saved = read(root, "03-信息记录/2026-10-07.md");
  assert.ok(saved.includes("新的完整原文。\n"));
  assert.ok(saved.includes("保留这句话。"));
  assert.equal(saved.split(`<!-- SOURCE_SYNC getnote ${notes[0].note_id} NOTE START -->`).length, 2);
  assert.ok(fs.existsSync(join(root, first.snapshot, "raw.json")));
});

test("empty source changes no information records, and first-run history is excluded", async (t) => {
  const root = setup(t), before = tree(root, "03-信息记录");
  const old = note(); old.created_at = "2026-10-05 10:00:00";
  assert.equal((await run(root, source([old]))).status, "skipped");
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.equal((await run(root, source([]))).status, "skipped");
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.equal(fs.existsSync(join(root, "outputs")), false);
});

test("detail or attachment failure commits neither partial records nor progress", async (t) => {
  const root = setup(t), before = tree(root, "03-信息记录"), notes = [note(), note("1923470895935554713")];
  const broken = source(notes);
  const detail = broken.detail;
  broken.detail = async (id) => { if (id.endsWith("13")) throw new Error("detail failed"); return detail(id); };
  await assert.rejects(run(root, broken), /detail failed/);
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.equal(fs.existsSync(join(root, ".zlx-cli/source-sync/getnote.json")), false);
  notes[0].attachments = [{ type: "audio", url: "https://example.com/source.mp3" }];
  const brokenAsset = source(notes);
  brokenAsset.asset = async () => { throw new Error("asset failed"); };
  await assert.rejects(run(root, brokenAsset), /asset failed/);
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.equal(fs.existsSync(join(root, "outputs")), false);
});

test("local edits inside source or index blocks stop source updates without overwriting", async (t) => {
  for (const relative of ["03-信息记录/2026-10-07.md", "03-信息记录/索引.md"]) {
    const root = setup(t), notes = [note()], adapter = source(notes);
    await run(root, adapter);
    const target = join(root, relative);
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("同名笔记", "用户手改标题"));
    const before = tree(root, "03-信息记录"), oldState = read(root, ".zlx-cli/source-sync/getnote.json");
    notes[0].content = "远端修改";
    await assert.rejects(run(root, adapter), /本地修改/);
    assert.deepEqual(tree(root, "03-信息记录"), before);
    assert.equal(read(root, ".zlx-cli/source-sync/getnote.json"), oldState);
  }
});

test("interrupted multi-file commit resumes once, with progress committed last", async (t) => {
  const root = setup(t), notes = [note()], adapter = source(notes);
  let interrupted = false;
  await assert.rejects(run(root, adapter, { beforeWrite(target) {
    if (target === "03-信息记录/索引.md" && !interrupted) { interrupted = true; throw new Error("simulated interruption"); }
  } }), /simulated interruption/);
  assert.equal(fs.existsSync(join(root, ".zlx-cli/source-sync/pending.json")), true);
  assert.equal(fs.existsSync(join(root, ".zlx-cli/source-sync/getnote.json")), false);
  const recovered = await run(root, adapter);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.added, 1);
  const saved = read(root, "03-信息记录/2026-10-07.md");
  assert.equal(saved.split(`<!-- SOURCE_SYNC getnote ${notes[0].note_id} NOTE START -->`).length, 2);
  assert.equal(fs.existsSync(join(root, ".zlx-cli/source-sync/pending.json")), false);
  assert.equal((await run(root, adapter)).status, "skipped");
});

test("recovery refuses to overwrite edits made after an interrupted commit", async (t) => {
  const root = setup(t), adapter = source([note()]);
  await assert.rejects(run(root, adapter, { beforeWrite(target) { if (target === "03-信息记录/索引.md") throw new Error("crash"); } }), /crash/);
  fs.appendFileSync(join(root, "03-信息记录/索引.md"), "\n用户刚写的备注。\n");
  const before = tree(root, "03-信息记录");
  await assert.rejects(run(root, adapter), /本地修改/);
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.equal(fs.existsSync(join(root, ".zlx-cli/source-sync/getnote.json")), false);
});

test("dry-run reads details but downloads no attachments and writes no source artifacts", async (t) => {
  const root = setup(t), notes = [note()], before = tree(root, "03-信息记录"), adapter = source(notes);
  notes[0].attachments = [{ type: "audio", url: "https://example.com/original.mp3" }];
  adapter.asset = async () => { throw new Error("dry-run must not download"); };
  const preview = await run(root, adapter, { dryRun: true });
  assert.equal(preview.status, "preview");
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.equal(fs.existsSync(join(root, "outputs")), false);
  assert.equal(fs.existsSync(join(root, ".zlx-cli/source-sync/getnote.json")), false);
});

test("attachment files are archived; signed URL refreshes alone do not update notes", async (t) => {
  const root = setup(t), notes = [note()], adapter = source(notes);
  notes[0].attachments = [{ type: "audio", url: "https://example.com/original.mp3?Expires=1&Signature=first" }];
  await run(root, adapter);
  const state = JSON.parse(read(root, ".zlx-cli/source-sync/getnote.json"));
  assert.equal(read(root, state.notes[notes[0].note_id].snapshot + "/attachment-1.mp3"), "original-attachment-bytes");
  const before = tree(root, "03-信息记录"), snapshots = tree(root, "outputs");
  notes[0].attachments[0].url = "https://example.com/original.mp3?Expires=2&Signature=second";
  assert.equal((await run(root, adapter)).status, "skipped");
  assert.deepEqual(tree(root, "03-信息记录"), before);
  assert.deepEqual(tree(root, "outputs"), snapshots);
});

test("new month/date sections remain descending and created-date changes relocate the owned block", async (t) => {
  const root = setup(t), notes = [note()], adapter = source(notes);
  await run(root, adapter);
  notes[0].created_at = "2026-11-01 12:00:00";
  notes[0].updated_at = "2026-11-01 13:00:00";
  const result = await run(root, adapter);
  assert.equal(result.updated, 1);
  assert.ok(!read(root, "03-信息记录/2026-10-07.md").includes("同名笔记"));
  assert.ok(read(root, "03-信息记录/2026-11-01.md").includes("同名笔记"));
  const index = read(root, "03-信息记录/索引.md");
  assert.ok(index.indexOf("## 2026-11") < index.indexOf("## 2026-10"));
  assert.ok(read(root, "03-信息记录/2026-10-07.md").includes("用户备注"));
});

test("response parsing preserves numeric int64 IDs and literal control characters; ISO dates use Shanghai", () => {
  const parsed = parseResponse('{"success":true,"data":{"note":{"id":1923470895935554712,"parent_id":1923470895935554713,"content":"原始\n换行"}}}');
  assert.equal(parsed.data.note.id, "1923470895935554712");
  assert.equal(parsed.data.note.parent_id, "1923470895935554713");
  assert.equal(parsed.data.note.content, "原始\n换行");
  assert.equal(sourceDate("2026-10-07T16:01:00Z"), "2026-10-08");
  assert.equal(sourceDate("2026-10-07 23:50:00"), "2026-10-07");
});

test("CLI routes sync help to the source-sync command", () => {
  const result = spawnSync(process.execPath, [resolve(__dirname, "../cli.js"), "record", "sync", "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /source-sync.json/);
});

test("Get quota errors retain safe retry metadata without leaking response contents", () => {
  assert.throws(() => parseResponse(JSON.stringify({ success: false, error: { code: 42900, reason: "quota_day",
    message: "private response text", rate_limit: { retry_after: 30 } } })), (error) => {
    assert.equal(error.reason, "quota_day");
    assert.equal(error.code, 42900);
    assert.equal(error.retryAfter, 30);
    assert.ok(!error.message.includes("private response text"));
    return true;
  });
});
