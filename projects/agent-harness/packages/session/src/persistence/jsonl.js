import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, truncate } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const openPaths = new Set();
const idPattern = /^[a-f0-9-]{36}$/i;

function createHandle(fd, path, rows) {
  let closed = false;
  return {
    id: basename(path, '.jsonl'),
    async read() { return rows.slice(); },
    async append(event) {
      if (closed) throw new Error('会话句柄已关闭');
      await fd.writeFile(`${JSON.stringify(event)}\n`);
      rows.push(event);
    },
    async flush() {
      if (closed) throw new Error('会话句柄已关闭');
      await fd.sync();
    },
    async close() {
      if (closed) return;
      try { await fd.sync(); } finally {
        closed = true;
        try { await fd.close(); } finally { openPaths.delete(path); }
      }
    },
  };
}

export function createJsonlBackend({ directory }) {
  const root = resolve(directory);
  const ready = mkdir(root, { recursive: true, mode: 0o700 });
  const pathOf = id => {
    if (!idPattern.test(id)) throw new Error('无效的 session id');
    return join(root, `${id}.jsonl`);
  };

  return {
    async create() {
      await ready;
      const id = randomUUID();
      const path = pathOf(id);
      if (openPaths.has(path)) throw new Error(`会话已有写入者：${id}`);
      const fd = await open(path, 'wx', 0o600);
      openPaths.add(path);
      return createHandle(fd, path, []);
    },
    async open(id) {
      await ready;
      const path = pathOf(id);
      if (openPaths.has(path)) throw new Error(`会话已有写入者：${id}`);
      openPaths.add(path);
      try {
        const bytes = await readFile(path);
        const lastNewline = bytes.lastIndexOf(10);
        if (lastNewline < 0) throw new Error('会话日志没有完整记录');
        if (lastNewline !== bytes.length - 1) await truncate(path, lastNewline + 1);
        const rows = bytes.subarray(0, lastNewline + 1).toString('utf8').trimEnd().split('\n').map(JSON.parse);
        const fd = await open(path, 'a');
        return createHandle(fd, path, rows);
      } catch (error) {
        openPaths.delete(path);
        throw error;
      }
    },
  };
}
