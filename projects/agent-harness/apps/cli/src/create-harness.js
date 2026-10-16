import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createToolRegistry, runTurn, createPermissionController, createLocalTools } from '@agent-harness/core';
import { createPiAiAdapter } from '@agent-harness/llm';
import { createSessionStore } from '@agent-harness/session';

const addTool = {
  name: 'add',
  permission: { effect: 'pure' },
  description: '计算两个数字之和。需要加法时调用。',
  parameters: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
  execute({ a, b }) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error('add 要求 a 和 b 都是有限数字');
    }
    return { sum: a + b };
  },
};

export function createHarness({ maxSteps = 4, protocol, mode, sandbox, approval, workspace } = {}) {
  const localEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(localEnv)) loadEnvFile(localEnv);
  const selectedProtocol = protocol ?? process.env.HARNESS_API_PROTOCOL ?? 'openai-completions';
  const model = createPiAiAdapter({
    protocol: selectedProtocol,
    baseUrl: selectedProtocol === 'anthropic-messages'
      ? process.env.HARNESS_ANTHROPIC_BASE_URL ?? 'https://zoperation.youzan.com/api/v1/messages'
      : process.env.HARNESS_BASE_URL,
    authToken: selectedProtocol === 'anthropic-messages'
      ? process.env.HARNESS_ANTHROPIC_AUTH_TOKEN ?? process.env.HARNESS_AUTH_TOKEN
      : process.env.HARNESS_AUTH_TOKEN,
    model: selectedProtocol === 'anthropic-messages'
      ? process.env.HARNESS_ANTHROPIC_MODEL ?? process.env.HARNESS_MODEL
      : process.env.HARNESS_MODEL,
    contextWindow: Number(process.env.HARNESS_CONTEXT_WINDOW ?? 128_000),
    maxTokens: Number(process.env.HARNESS_MAX_TOKENS ?? 512),
  });
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const permissions = createPermissionController({ mode, sandbox, approval, workspace,
    protectedPaths: ['apps', 'packages', 'node_modules', '.data', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']
      .map(path => `${root}${path}`) });
  const tools = createToolRegistry([addTool, ...createLocalTools(permissions.config)], { permissions });
  const store = createSessionStore({ directory: fileURLToPath(new URL('../../../.data/sessions/', import.meta.url)) });

  return {
    permissions: permissions.config,
    async history(sessionId) {
      const session = await store.open(sessionId);
      try {
        await session.repairInterrupted();
        return { sessionId, messages: session.messages, events: session.events };
      } finally {
        await session.close();
      }
    },
    async run(prompt, { sessionId, requireTool = false, signal, onEvent, requestApproval } = {}) {
      const session = sessionId ? await store.open(sessionId) : await store.create({
        systemPrompt: '你是一个简洁的助手。加法计算使用 add 工具；文件和程序操作使用相应工具。权限由宿主执行，不要把失败当成成功，不要通过换工具重试被拒绝的动作。',
      });
      try {
        if (sessionId) await session.repairInterrupted();
        return await runTurn({ model, tools, session, userInput: prompt, maxSteps, requireTool, signal, onEvent, requestApproval });
      } finally {
        await session.close();
      }
    },
  };
}
