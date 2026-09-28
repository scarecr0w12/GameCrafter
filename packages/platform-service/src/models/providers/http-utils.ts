import {
  RpcError,
  RpcErrorCode,
  redact,
  type Model,
  type ModelUsage,
} from '@gamecrafter/contracts';
import type { ProviderRuntimeAccount } from './provider';

export function endpoint(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

export function providerHeaders(
  account: ProviderRuntimeAccount,
  overrides: Record<string, string> = {},
): Headers {
  const headers = new Headers(account.headers);
  for (const [name, value] of Object.entries(overrides)) headers.set(name, value);
  if (account.apiKey && !headers.has('authorization') && !headers.has('x-api-key')) {
    headers.set('authorization', `Bearer ${account.apiKey}`);
  }
  return headers;
}

export async function providerFetch(
  account: ProviderRuntimeAccount,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = providerHeaders(account, Object.fromEntries(new Headers(init.headers).entries()));
  try {
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      throw providerError(account, `HTTP ${response.status}`, response.status, body);
    }
    return response;
  } catch (error) {
    if (error instanceof RpcError || (error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }
    throw providerError(account, error instanceof Error ? error.message : String(error), null, '');
  }
}

export async function providerJson<T>(
  account: ProviderRuntimeAccount,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await providerFetch(account, url, init);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw providerError(
      account,
      `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`,
      response.status,
      '',
    );
  }
}

export function modelCost(model: Model, inputTokens: number, outputTokens: number): number | null {
  const inputRate = model.pricing.inputPerMTokUsd;
  const outputRate = model.pricing.outputPerMTokUsd;
  if (inputRate === null || outputRate === null) return null;
  return (inputRate * inputTokens + outputRate * outputTokens) / 1_000_000;
}

export function modelUsage(model: Model, inputTokens: number, outputTokens: number): ModelUsage {
  return {
    inputTokens,
    outputTokens,
    costUsd: modelCost(model, inputTokens, outputTokens),
  };
}

export function safeExcerpt(body: string, credential?: string): string {
  let excerpt = body.slice(0, 512);
  if (credential) excerpt = excerpt.replaceAll(credential, '[REDACTED]');
  excerpt = excerpt
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(
      /((?:api[-_]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;}]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(?:sk|ghp|xox[abp]|AKIA)[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
    .replace(/[A-Fa-f0-9]{40,}/g, '[REDACTED]');
  return excerpt;
}

function providerError(
  account: ProviderRuntimeAccount,
  reason: string,
  status: number | null,
  body: string,
): RpcError {
  const excerpt = safeExcerpt(body, account.apiKey);
  const detail = excerpt ? `: ${excerpt}` : '';
  return new RpcError(
    `Provider request failed${status === null ? '' : ` (HTTP ${status})`}: ${reason}${detail}`,
    RpcErrorCode.ProviderRequestFailed,
    { status, body: redact(excerpt) },
  );
}
