export function apiRoot(protocol, baseUrl) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('模型地址必须是无查询参数的 HTTP(S) URL');
  }
  const suffix = protocol === 'anthropic-messages' ? /\/v1\/messages\/?$/ : /\/chat\/completions\/?$/;
  url.pathname = url.pathname.replace(suffix, '') || '/';
  return url.toString().replace(/\/$/, '');
}

export function createPiModel(profile) {
  const { protocol, baseUrl, model, contextWindow, maxTokens } = profile;
  if (!['openai-completions', 'anthropic-messages'].includes(protocol)) throw new Error(`不支持的模型协议：${protocol}`);
  if (!baseUrl || !model || !Number.isInteger(contextWindow) || contextWindow < 1
    || !Number.isInteger(maxTokens) || maxTokens < 1) throw new Error('模型配置缺少有效的地址、模型或容量');
  return Object.freeze({
    id: model, name: model, api: protocol, provider: profile.provider ?? 'configured-gateway',
    baseUrl: apiRoot(protocol, baseUrl), reasoning: profile.reasoning ?? false,
    input: profile.input ?? ['text'],
    cost: profile.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow, maxTokens,
    ...(protocol === 'openai-completions' ? { compat: profile.compat ?? {
      supportsStore: false, supportsDeveloperRole: false,
      supportsReasoningEffort: false, supportsUsageInStreaming: false,
      supportsStrictMode: false, maxTokensField: 'max_tokens',
    } } : {}),
  });
}
