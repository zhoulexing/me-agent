"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI = resolve(__dirname, "../cli.js");

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

test("auth status reads project-local JSON files and rejects loose credential permissions", () => {
  const root = mkdtempSync(join(tmpdir(), "zlx-cli-config-"));
  try {
    const auth = join(root, "cmd", "auth");
    mkdirSync(auth, { recursive: true });
    for (const name of ["config.js", "status.js"])
      copyFileSync(resolve(__dirname, "../auth", name), join(auth, name));
    const directory = join(root, ".config");
    mkdirSync(directory);
    const getnote = join(directory, "getnote.json");
    writeFileSync(getnote, JSON.stringify({ apiKey: "test-key", clientId: "test-client" }), { mode: 0o600 });
    const env = { ...process.env, HOME: join(root, "unrelated-home"), GETNOTE_API_KEY: "ignored-env-key" };
    const status = join(auth, "status.js");
    const configured = spawnSync(process.execPath, [status, "--json"], { encoding: "utf8", env });
    assert.equal(configured.status, 0, configured.stderr);
    assert.equal(JSON.parse(configured.stdout).getnote.apiKey, true);
    chmodSync(getnote, 0o644);
    const insecure = spawnSync(process.execPath, [status], { encoding: "utf8", env });
    assert.notEqual(insecure.status, 0);
    assert.match(insecure.stderr, /chmod 600/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("record add preserves same-day entries and keeps the index date-sorted", () => {
  const root = mkdtempSync(join(tmpdir(), "zlx-cli-record-"));
  try {
    mkdirSync(join(root, "03-信息记录"));
    const source = join(root, "source.txt");
    writeFileSync(source, "保留原始内容。\n");
    for (const [date, title] of [
      ["2026-09-29", "第一件事"],
      ["2026-09-29", "第二件事"],
      ["2026-09-28", "昨天的事"],
    ]) {
      const result = run(["record", "add", "--workspace", root, "--date", date, "--title", title,
        "--type", "待办", "--tags", "生活,事项", "--summary", title, "--content-file", source]);
      assert.equal(result.status, 0, result.stderr);
    }
    const day = readFileSync(join(root, "03-信息记录", "2026-09-29.md"), "utf8");
    assert.match(day, /## 20260929-01 第一件事/);
    assert.match(day, /## 20260929-02 第二件事/);
    assert.equal((day.match(/保留原始内容/g) || []).length, 2);
    const index = readFileSync(join(root, "03-信息记录", "索引.md"), "utf8");
    assert.ok(index.indexOf("2026-09-29") < index.indexOf("2026-09-28"));
    assert.match(index, /\*\*第二件事\*\*｜待办｜#生活 #事项｜第二件事/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Get note request keeps large note IDs exact and guards external writes", () => {
  const root = mkdtempSync(join(tmpdir(), "zlx-cli-getnote-"));
  try {
    const body = join(root, "body.json");
    writeFileSync(body, '{"note_id":1896830231705320746,"title":"测试"}');
    const path = "/open/api/v1/resource/note/update";
    const blocked = run(["getnote", "request", "POST", path, "--body-file", body]);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /--execute/);
    const preview = run(["getnote", "request", "POST", path, "--body-file", body, "--dry-run"]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /1896830231705320746/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("WeChat draft dry-run validates local inputs without publishing", () => {
  const root = mkdtempSync(join(tmpdir(), "zlx-cli-wechat-"));
  try {
    const html = join(root, "article.html");
    const cover = join(root, "cover.png");
    writeFileSync(html, "<p>正文</p>");
    writeFileSync(cover, "fake-image-for-dry-run");
    const result = run(["wechat", "draft", "--title", "测试文章", "--html-file", html,
      "--cover-image", cover, "--dry-run"]);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.dryRun, true);
    assert.equal(output.action, "create-draft");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("WeChat composition keeps the source text and writes HTML through the CLI", () => {
  const root = mkdtempSync(join(tmpdir(), "zlx-cli-compose-"));
  try {
    const source = join(root, "source.md");
    const plan = join(root, "layout.json");
    const output = join(root, "article.html");
    writeFileSync(source, "第一段原文。\n\n第二段原文。\n");
    writeFileSync(plan, '{"insertions":[{"before":1,"heading":"章节标题"}]}');
    const result = run(["wechat", "compose", "--input", source, "--plan", plan, "--output", output]);
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(output, "utf8");
    assert.ok(html.indexOf("第一段原文") < html.indexOf("章节标题"));
    assert.ok(html.indexOf("章节标题") < html.indexOf("第二段原文"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("video review command converts transcription into an editable document", () => {
  const root = mkdtempSync(join(tmpdir(), "zlx-cli-video-"));
  try {
    const input = join(root, "transcription.json");
    const output = join(root, "review.md");
    writeFileSync(input, JSON.stringify({ transcription: [{ offsets: { from: 0, to: 1200 }, text: "测试口播" }] }));
    const result = run(["video", "review", "--input", input, "--output", output]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(output, "utf8"), /测试口播/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
