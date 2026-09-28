const sensitiveKeyPattern =
  /(token|secret|password|passwd|api[-_]?key|authorization|cookie|private[-_]?key)/i;
const tokenValuePattern = /^(sk|ghp|xox[abp]|AKIA)[A-Za-z0-9_-]{16,}$/;
const longEncodedValuePattern = /^[A-Za-z0-9+/=_-]{40,}$/;

export function redact<T>(value: T, extraKeyPatterns: RegExp[] = []): T {
  const serialized = JSON.stringify(value);
  const clone: unknown = serialized === undefined ? undefined : JSON.parse(serialized);
  return redactValue(clone, extraKeyPatterns) as T;
}

function redactValue(value: unknown, extraKeyPatterns: RegExp[]): unknown {
  if (typeof value === 'string') {
    return tokenValuePattern.test(value) || longEncodedValuePattern.test(value)
      ? '[REDACTED]'
      : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, extraKeyPatterns));
  if (typeof value !== 'object' || value === null) return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (matchesKey(key, extraKeyPatterns)) redacted[key] = '[REDACTED]';
    else redacted[key] = redactValue(nested, extraKeyPatterns);
  }
  return redacted;
}

function matchesKey(key: string, extraKeyPatterns: RegExp[]): boolean {
  if (sensitiveKeyPattern.test(key)) return true;
  return extraKeyPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(key);
  });
}
