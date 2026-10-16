import { createSandboxExecutor } from '../permissions/sandbox.js';

// The worker source is host-owned, loaded before execution, and sent via -e.
// Both file helpers and arbitrary commands cross the same OS boundary.
const fileWorker = `
const fs = require('node:fs');
const {operation, path, content} = JSON.parse(fs.readFileSync(0, 'utf8'));
if (operation === 'read') {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 65536) throw Error('只读取不超过 64 KiB 的普通文件');
    const buffer = Buffer.alloc(65537);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (size > 65536) throw Error('文件过大');
    console.log(JSON.stringify({path, content: buffer.subarray(0, size).toString('utf8')}));
  } finally { fs.closeSync(fd); }
} else {
  const fd = fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink > 1) throw Error('禁止写入特殊文件或硬链接');
    fs.ftruncateSync(fd, 0);
    fs.writeFileSync(fd, content);
    console.log(JSON.stringify({path, bytes: Buffer.byteLength(content)}));
  } finally { fs.closeSync(fd); }
}`;

export function createLocalTools(config) {
  const execute = createSandboxExecutor(config);
  const fileTool = (name, effect) => ({
    name, description: effect === 'read' ? '读取工作区内的 UTF-8 文本文件（最多 64 KiB）。' : '写入 UTF-8 文本文件；父目录必须存在，会覆盖已有内容。',
    permission: { effect, pathArgument: 'path' },
    parameters: { type: 'object', properties: { path: { type: 'string' },
      ...(effect === 'write' ? { content: { type: 'string' } } : {}) },
      required: effect === 'write' ? ['path', 'content'] : ['path'], additionalProperties: false },
    validate(args) {
      if (typeof args.path !== 'string') throw new Error('path 必须是字符串');
      if (effect === 'write' && (typeof args.content !== 'string' || Buffer.byteLength(args.content) > 65536)) {
        throw new Error('content 必须是不超过 64 KiB 的字符串');
      }
    },
    async execute(args, { signal }) {
      const result = await execute(process.execPath, ['-e', fileWorker], {
        signal, stdin: JSON.stringify({ operation: effect, ...args }),
      });
      return JSON.parse(result.stdout);
    },
  });
  return [fileTool('read_file', 'read'), fileTool('write_file', 'write'), {
    name: 'exec', description: '执行程序及参数。运行脚本、解释器和子进程均受同一沙箱限制。shell 语法需显式使用 /bin/sh -c。',
    permission: { effect: 'exec' },
    parameters: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } } },
      required: ['command', 'args'], additionalProperties: false },
    validate({ command, args }) {
      if (typeof command !== 'string' || !command || command.includes('\0')
        || !Array.isArray(args) || args.some(a => typeof a !== 'string' || a.includes('\0'))
        || Buffer.byteLength(JSON.stringify({ command, args })) > 65536) throw new Error('无效 command / args');
    },
    execute({ command, args }, { signal }) { return execute(command, args, { signal }); },
  }];
}
