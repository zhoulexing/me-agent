import { createPermissionController, freeze } from '../permissions/policy.js';

export function createToolRegistry(definitions, { permissions = createPermissionController() } = {}) {
  const byName = new Map();
  for (const definition of definitions) {
    if (!definition.name || byName.has(definition.name)) throw new Error(`无效或重复的工具名：${definition.name}`);
    byName.set(definition.name, { ...definition, permission: definition.permission && { ...definition.permission } });
  }

  return {
    permissions: permissions.config,
    schemas() {
      return [...byName.values()].map(({ name, description, parameters }) => ({ name, description, parameters }));
    },
    async execute(call, { signal, emit, requestApproval, beforeExecute } = {}) {
      const definition = byName.get(call?.name);
      if (!definition) throw new Error(`未知工具：${call?.name ?? '(empty)'}`);
      if (!call.id) throw new Error('工具调用缺少 id');
      signal?.throwIfAborted();
      const args = structuredClone(call.arguments ?? {});
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('工具参数必须是对象');
      const allowed = Object.keys(definition.parameters?.properties ?? {});
      if (Object.keys(args).some(key => !allowed.includes(key))) throw new Error('工具包含未声明参数');
      definition.validate?.(args);
      const action = permissions.prepare(definition, args);
      const prepared = freeze({ id: call.id, name: call.name, arguments: args });
      await permissions.authorize(prepared, action, { signal, emit, requestApproval });
      signal?.throwIfAborted();
      await beforeExecute?.(prepared);
      signal?.throwIfAborted();
      return { name: prepared.name, result: await definition.execute(prepared.arguments, { signal }) };
    },
  };
}
