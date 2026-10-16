import { realpathSync, lstatSync } from 'node:fs';
import { resolve, relative, dirname, basename, sep } from 'node:path';
import { createHash } from 'node:crypto';

// Presets are product choices; approval and enforcement remain independent axes.
export const MODES = Object.freeze({
  default: { sandbox: 'workspace-write', approval: 'on-request' },
  ask: { sandbox: 'workspace-write', approval: 'on-request' },
  auto: { sandbox: 'workspace-write', approval: 'auto' },
  workspace: { sandbox: 'workspace-write', approval: 'never' },
  'read-only': { sandbox: 'read-only', approval: 'never' },
  'full-access': { sandbox: 'none', approval: 'never' },
});
export const SANDBOXES = ['read-only', 'workspace-write', 'none'];
export const APPROVALS = ['on-request', 'always', 'auto', 'never'];
export const PROTECTED_NAMES = ['.git', '.agents', '.codex', '.claude', '.data', '.env', 'AGENTS.md'];

export function isWithin(root, path) {
  const rel = relative(root, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep));
}

// Resolve existing ancestors too: a new file under a symlink must not escape.
export function canonicalPath(path) {
  try { return realpathSync(path); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // Dangling symlinks are not ordinary missing paths.
    try { if (lstatSync(path).isSymbolicLink()) throw new Error('不允许悬空符号链接'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const parent = dirname(path);
    if (parent === path) throw error;
    return resolve(canonicalPath(parent), basename(path));
  }
}

export function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function permissionError(message) {
  return Object.assign(new Error(message), { code: 'PERMISSION_DENIED' });
}

async function abortable(work, signal) {
  signal?.throwIfAborted();
  if (!signal) return work();
  let abort;
  try {
    return await Promise.race([Promise.resolve().then(work), new Promise((_, reject) => {
      abort = () => reject(signal.reason ?? new Error('已取消'));
      signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { signal.removeEventListener('abort', abort); }
}

export function createPermissionController({ mode = 'default', sandbox, approval,
  workspace = process.cwd(), protectedPaths = [], review = conservativeReview } = {}) {
  if (!Object.hasOwn(MODES, mode)) throw new Error(`未知权限模式：${mode}`);
  sandbox ??= MODES[mode].sandbox;
  approval ??= MODES[mode].approval;
  if (!SANDBOXES.includes(sandbox) || !APPROVALS.includes(approval)) throw new Error('无效 sandbox / approval 配置');
  const config = freeze({ mode, sandbox, approval, workspace: realpathSync(workspace),
    network: sandbox === 'none' ? 'allow' : 'deny',
    protectedPaths: protectedPaths.map(path => canonicalPath(resolve(path))) });

  return {
    config,
    prepare(definition, args) {
      const effect = definition.permission?.effect;
      if (!['pure', 'read', 'write', 'exec'].includes(effect)) throw permissionError('工具未声明受信任的权限元数据');
      const action = { effect };
      if (effect === 'read' || effect === 'write') {
        const key = definition.permission.pathArgument;
        if (!key || typeof args[key] !== 'string' || !args[key] || args[key].includes('\0')) {
          throw permissionError('文件工具需要有效路径');
        }
        action.path = canonicalPath(resolve(config.workspace, args[key]));
        args[key] = action.path;
      }
      return action;
    },
    async authorize(call, action, { signal, requestApproval, emit = async () => {} } = {}) {
      signal?.throwIfAborted();
      const digest = createHash('sha256').update(JSON.stringify({ call, action, config })).digest('hex');
      const request = freeze({ requestId: `${call.id}:${digest.slice(0, 16)}`, digest,
        callId: call.id, name: call.name, arguments: call.arguments, action, config });
      const decided = async (decision, source, reason) => {
        await emit('permission.decided', { ...request, decision, source, reason });
        if (decision !== 'allow') throw permissionError(reason);
      };
      // Hard boundaries are evaluated before any approver; approval cannot widen them.
      if (config.sandbox !== 'none') {
        if (action.path && !isWithin(config.workspace, action.path)) {
          return decided('deny', 'policy', '路径在工作区之外；一次批准不会扩大沙箱范围');
        }
        if (action.path && relative(config.workspace, action.path).split(sep).some(p => p === '.env' || p.startsWith('.env.'))) {
          return decided('deny', 'policy', '凭据文件禁止读取或写入');
        }
        if (action.effect === 'write') {
          if (config.sandbox === 'read-only') return decided('deny', 'policy', '只读沙箱禁止写入');
          if (action.path === config.workspace || relative(config.workspace, action.path).split(sep).some(p => PROTECTED_NAMES.includes(p))
            || config.protectedPaths.some(p => isWithin(p, action.path))) {
            return decided('deny', 'policy', '禁止修改权限配置、运行时或审计目录');
          }
        }
      }
      const needsApproval = config.approval === 'always'
        || (config.approval !== 'never' && ['write', 'exec'].includes(action.effect));
      if (!needsApproval) return decided('allow', 'policy', '当前策略允许在既定范围内执行');
      if (config.approval === 'auto') {
        let result;
        try { result = await abortable(() => review(request, { signal }), signal); }
        catch { result = { decision: 'deny', reason: '自动审核器失败，拒绝执行' }; }
        signal?.throwIfAborted();
        if (!['allow', 'deny', 'ask'].includes(result?.decision)) result = { decision: 'deny', reason: '自动审核器返回无效结果' };
        await emit('permission.reviewed', { ...request, ...result });
        if (result.decision !== 'ask') return decided(result.decision, 'reviewer', result.reason ?? '自动审核');
      }
      await emit('permission.requested', request);
      let approved = false;
      try { approved = requestApproval ? await abortable(() => requestApproval(request, { signal }), signal) : false; }
      catch (error) {
        if (signal?.aborted) throw error;
        return decided('deny', 'human', '批准通道失败，拒绝执行');
      }
      signal?.throwIfAborted();
      return decided(approved === true ? 'allow' : 'deny', 'human',
        approved === true ? '用户仅批准本次调用，沙箱保持不变' : '用户拒绝或没有可用的批准通道');
    },
  };
}

// A transparent rules reviewer, NOT a semantic/model-based safety classifier.
export function conservativeReview({ action, config }) {
  if (action.effect === 'write' && config.sandbox === 'workspace-write') {
    return { decision: 'allow', reason: '规则审核：允许工作区内、非保护路径的结构化写入' };
  }
  if (['pure', 'read'].includes(action.effect)) return { decision: 'allow', reason: '规则审核：纯计算或受限读取' };
  return { decision: 'ask', reason: '无法证明任意程序的副作用，转交用户批准' };
}
