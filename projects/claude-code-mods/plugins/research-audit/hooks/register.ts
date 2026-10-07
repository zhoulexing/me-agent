import type { Register } from 'claude-code';
export const register: Register = (on, options) => {
  let before = 0, after = 0, denied = 0, processed = 0;
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'research-audit-status', description: 'Only audit counts, no private input' });
    return next(e);
  });
  on('plugin.register', async ($, e, next) => {
    if (options.refuseProcess === true && e.uses.calls.includes('process.run')) return { refuse: '教学审计拒绝进程能力' };
    return next(e);
  });
  on('tool.call', { tool: 'mcp__research-notebook__fixture' }, async ($, e, next) => {
    before++;
    const result = await next(e);
    after++;
    if (result.deny || result.isError) denied++;
    else {
      const body = typeof result.result === 'string' ? result.result : '{}';
      if (JSON.parse(body).processed === true) processed++;
    }
    $.ui.log('audit before=' + before + ' after=' + after + ' denied=' + denied + ' processed=' + processed);
    return result;
  }).catch(async () => ({ deny: '审计异常；本次工具调用关闭' }));
  on('command.run', {command:'research-run'}, async ($,e,next) => {
    const r = await next(e);
    return {...r, text:(r.text ?? '') + '\nAUDIT before=' + before + ' after=' + after + ' denied=' + denied + ' processed=' + processed};
  });
  on('command.run', { command: 'research-audit-status' }, async () => ({ text: JSON.stringify({ before, after, denied, processed }) }));
};
