import { spawn } from 'node:child_process';
import { existsSync, realpathSync, lstatSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isWithin } from './policy.js';

// Path sandboxes cannot distinguish two names of the same inode. Refuse
// pre-existing hardlinks in the execution tree; do not traverse symlinks.
// An unrelated host process concurrently mutating this tree is outside this
// teaching backend's threat model (use a dedicated volume/VM for that case).
function assertNoHardlinks(root) {
  let count = 0;
  const visit = path => {
    if (++count > 100_000) throw new Error('工作区过大，无法完成硬链接检查；请选择独立的小型工作区');
    const stat = lstatSync(path);
    if (stat.isFile() && stat.nlink > 1) throw new Error(`工作区含硬链接，拒绝受限执行：${path}`);
    if (stat.isDirectory()) for (const entry of readdirSync(path)) visit(join(path, entry));
  };
  visit(root);
}

// No source-code/command regex pretends to determine a program's effects.
// Seatbelt applies to syscalls of the process AND its descendants.
export function seatbeltProfile(config) {
  const quote = value => JSON.stringify(value);
  const runtimeRoots = ['/System', '/usr', '/bin', '/sbin', '/Library/Apple', '/opt/homebrew',
    dirname(dirname(realpathSync(process.execPath)))];
  const reads = [...new Set([config.workspace, ...runtimeRoots])].map(p => `(subpath ${quote(p)})`).join('\n');
  const protectedFilters = config.protectedPaths.map(p => `(subpath ${quote(p)})`).join('\n');
  const ancestors = new Set([config.workspace]);
  for (const path of config.protectedPaths) {
    for (let parent = dirname(path); isWithin(config.workspace, parent); parent = dirname(parent)) {
      ancestors.add(parent);
      if (parent === config.workspace || parent === dirname(parent)) break;
    }
  }
  const ancestorFilters = [...ancestors].map(p => `(literal ${quote(p)})`).join('\n');
  return `(version 1)
(deny default)
(allow process-exec process-fork)
(allow signal (target same-sandbox))
(allow process-info* (target same-sandbox))
(allow sysctl-read)
(allow file-read-metadata)
(allow file-read* ${reads}
  (literal "/")
  (literal "/dev/null") (literal "/dev/urandom") (literal "/dev/random")
  (literal "/private/etc/localtime"))
(allow file-write-data (literal "/dev/null"))
${config.sandbox === 'workspace-write' ? `(allow file-write* (subpath ${quote(config.workspace)}))` : ''}
; Never let workspace code edit its controller or session journal.
(deny file-write* (literal ${quote(config.workspace)}) ${protectedFilters}
  (regex #"(^|/)([.]git|[.]agents|[.]codex|[.]claude|[.]data|AGENTS[.]md)(/|$)"))
; A rename of an unprotected ancestor would otherwise relocate the protected tree.
(deny file-write-unlink ${ancestorFilters})
(deny file-read-data file-write* (regex #"(^|/)[.]env([.][^/]*)?(/|$)"))
`;
}

export function createSandboxExecutor(config, { timeoutMs = 10_000, maxOutputBytes = 128 * 1024 } = {}) {
  return async function execute(command, args, { signal, stdin = '' } = {}) {
    signal?.throwIfAborted();
    const restricted = config.sandbox !== 'none';
    if (restricted && (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec'))) {
      throw new Error('沙箱不可用：当前实现需要 macOS sandbox-exec；不会降级为裸执行');
    }
    if (restricted) assertNoHardlinks(config.workspace);
    const executable = restricted ? '/usr/bin/sandbox-exec' : command;
    const argv = restricted ? ['-p', seatbeltProfile(config), command, ...args] : args;
    // Do not pass provider credentials, NODE_OPTIONS, loader hooks or shell startup environment.
    const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin`,
      HOME: config.workspace, TMPDIR: config.workspace, LANG: 'en_US.UTF-8' };
    return new Promise((resolve, reject) => {
      let stdout = '', stderr = '', bytes = 0, failure;
      const child = spawn(executable, argv, { cwd: config.workspace, env,
        stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
      const kill = () => {
        try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      };
      const abort = () => { failure = signal.reason ?? new Error('已取消'); kill(); };
      const timer = setTimeout(() => { failure = new Error('工具执行超时'); kill(); }, timeoutMs);
      const collect = (key, data) => {
        bytes += data.length;
        if (bytes > maxOutputBytes) { failure = new Error('工具输出超出限制'); kill(); return; }
        if (key === 'stdout') stdout += data.toString(); else stderr += data.toString();
      };
      child.stdout.on('data', data => collect('stdout', data));
      child.stderr.on('data', data => collect('stderr', data));
      child.stdin.on('error', () => {}); // An early policy denial may close stdin.
      child.on('error', error => { failure = error; });
      child.on('close', (exitCode, exitSignal) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        kill(); // Best effort: don't leave ordinary background children running.
        if (failure) reject(failure);
        else if (exitCode !== 0) reject(new Error(`执行失败 (${exitCode ?? exitSignal}): ${stderr || stdout}`));
        else resolve({ stdout, stderr, exitCode, sandbox: config.sandbox });
      });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      child.stdin.end(stdin);
    });
  };
}
