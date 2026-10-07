"use strict";

const { createHash } = require("node:crypto");
const { readResource, responseError } = require("./request");
const { headers } = require("../../auth/getnote");

// Preserve int64 IDs during parsing. The untouched response is archived separately.
function parseResponse(raw) {
  let output = "", quoted = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (quoted) {
      if (char === "\\") { output += char + raw[++i]; continue; }
      if (char === '"') quoted = false;
      output += char.charCodeAt(0) < 32 ? JSON.stringify(char).slice(1, -1) : char;
    } else if (char === '"') {
      quoted = true; output += char;
    } else if (char === "-" || /[0-9]/.test(char)) {
      const token = raw.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)[0];
      output += /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token)) ? JSON.stringify(token) : token;
      i += token.length - 1;
    } else output += char;
  }
  let data;
  try { data = JSON.parse(output); } catch { throw new Error("Get 返回数据无法解析"); }
  if (data.success !== true) throw responseError(null, raw);
  if (!data.data) throw new Error("Get 笔记未返回成功的数据");
  return data;
}

async function retry(action) {
  try { return await action(); } catch (error) {
    if (["quota_day", "quota_month", "not_member"].includes(error.reason) || [401, 403].includes(error.status)) throw error;
    const limited = error.status === 429 || error.code === 10202 || error.code === 42900;
    const seconds = limited ? (error.retryAfter || 10) : 5;
    if (seconds > 60) throw new Error(`Get 限流要求等待 ${seconds} 秒，本次停止，稍后再运行`);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return action();
  }
}

function createGetnoteSource() {
  const identity = createHash("sha256").update(JSON.stringify(headers())).digest("hex");
  let nextRequestAt = 0;
  async function load(path) {
    return retry(async () => {
      const wait = nextRequestAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      nextRequestAt = Date.now() + 1200;
      const raw = await readResource(path);
      return { raw, parsed: parseResponse(raw) };
    });
  }
  return {
    name: "getnote", identity,
    async list() {
      const notes = new Map(), cursors = new Set();
      let cursor = "", pages = 0, total;
      while (true) {
        const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        const { parsed: response } = await load(`/open/api/v1/resource/note/list${suffix}`);
        const data = response.data;
        if (!Array.isArray(data.notes) || typeof data.has_more !== "boolean")
          throw new Error("Get 列表字段不完整");
        if (total === undefined) total = data.total;
        if (data.total !== total) throw new Error("翻页期间笔记总数发生变化，请重试");
        pages += 1;
        for (const note of data.notes) {
          const id = String(note.note_id ?? note.id ?? "");
          if (!/^\d+$/.test(id)) throw new Error("Get 列表缺少准确的笔记 ID");
          notes.set(id, { ...note, note_id: id });
        }
        if (!data.has_more) break;
        cursor = String(data.cursor ?? "");
        if (!cursor || cursors.has(cursor) || pages >= 10000) throw new Error("Get 翻页游标缺失或重复");
        cursors.add(cursor);
      }
      if (total !== undefined && Number(total) !== notes.size) throw new Error("Get 列表数量与总数不一致");
      return { notes: [...notes.values()], pages, total: notes.size };
    },
    async detail(id) {
      const { raw, parsed } = await load(`/open/api/v1/resource/note/detail?id=${encodeURIComponent(id)}&image_quality=original`);
      const note = parsed.data.note;
      if (!note || String(note.note_id ?? note.id) !== id) throw new Error("Get 详情 ID 与列表不一致");
      return { note: { ...note, note_id: id }, raw };
    },
    async asset(url) {
      return retry(async () => {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.hostname === "localhost") throw new Error("附件地址必须为 HTTPS");
        const response = await fetch(parsed, { signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`Get 附件 HTTP ${response.status}`);
        const reader = response.body.getReader(), chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256 * 1024 * 1024) { await reader.cancel(); throw new Error("附件超过 256 MiB，请单独处理"); }
          chunks.push(Buffer.from(value));
        }
        if (!size) throw new Error("Get 附件返回空文件");
        return Buffer.concat(chunks);
      });
    },
  };
}

module.exports = { createGetnoteSource, parseResponse };
