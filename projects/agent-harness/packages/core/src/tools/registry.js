export function createToolRegistry(definitions) {
  const byName = new Map();
  for (const definition of definitions) {
    if (!definition.name || byName.has(definition.name)) throw new Error(`无效或重复的工具名：${definition.name}`);
    byName.set(definition.name, definition);
  }

  return {
    schemas() {
      return [...byName.values()].map(({ name, description, parameters }) => ({ name, description, parameters }));
    },
    async execute(call, { signal } = {}) {
      const definition = byName.get(call?.name);
      if (!definition) throw new Error(`未知工具：${call?.name ?? '(empty)'}`);
      if (!call.id) throw new Error('工具调用缺少 id');
      signal?.throwIfAborted();
      return { name: call.name, result: await definition.execute(call.arguments ?? {}, { signal }) };
    },
  };
}
