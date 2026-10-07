export class LlmError extends Error {
  constructor(message, code = 'PROVIDER_ERROR') {
    super(message);
    this.name = 'LlmError';
    this.code = code;
  }
}

export function providerFailure(message) {
  if (/\b(?:401|403)\b/.test(message)) return { code: 'AUTH', message };
  if (/\b429\b|rate.?limit/i.test(message)) return { code: 'RATE_LIMIT', message };
  if (/\btimeout|timed out\b/i.test(message)) return { code: 'TIMEOUT', message };
  if (/\b(?:network|connection|socket|fetch)\b/i.test(message)) return { code: 'TRANSPORT', message };
  return { code: 'PROVIDER_ERROR', message };
}
