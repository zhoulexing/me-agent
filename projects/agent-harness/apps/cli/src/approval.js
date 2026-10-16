// One reader owns readline input. Approval replies cannot become new user turns.
export function createLineReader(rl) {
  let pending, closed = false;
  const queue = [];
  rl.on('line', line => {
    if (pending) { const resolve = pending; pending = undefined; resolve(line); }
    else queue.push(line);
  });
  rl.on('close', () => { closed = true; pending?.(undefined); pending = undefined; });
  return {
    async next({ signal, fresh = false } = {}) {
      signal?.throwIfAborted();
      if (fresh) queue.length = 0; // Pasted/queued text never pre-approves future actions.
      if (queue.length) return queue.shift();
      if (closed) return undefined;
      return new Promise((resolve, reject) => {
        const abort = () => { pending = undefined; reject(signal.reason); };
        pending = line => { signal?.removeEventListener('abort', abort); resolve(line); };
        signal?.addEventListener('abort', abort, { once: true });
      });
    },
  };
}

export function terminalApprover({ reader, output, enabled }) {
  if (!enabled) return undefined;
  return async (request, { signal } = {}) => {
    // JSON escaping also keeps embedded terminal escape sequences inert.
    output.write(`\n[需要批准 ${request.requestId}]\n工具：${request.name}\n参数：${JSON.stringify(request.arguments)}\n沙箱：${request.config.sandbox}；工作区：${JSON.stringify(request.config.workspace)}；网络：${request.config.network}\n仅批准本次调用，沙箱不变。输入 y 批准，其他输入拒绝 > `);
    const answer = await reader.next({ signal, fresh: true });
    return answer?.trim().toLowerCase() === 'y';
  };
}
