import {
  RpcError,
  RpcErrorCode,
  redact,
  type AssetJobRequest,
  type AssetProviderCapabilities,
  type AssetProviderKind,
} from '@gamecrafter/contracts';

export interface ProviderContext {
  baseUrl: string;
  apiKey: string;
  fetch: typeof fetch;
  timeoutMs: number;
}

export interface ProviderTaskOutput {
  url: string;
  kind: 'model' | 'thumbnail' | 'texture' | 'other';
  format: string;
}

export interface ProviderTaskState {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  progress: number;
  outputs: ProviderTaskOutput[];
  creditsConsumed: number | null;
  error: string | null;
  retryAfterMs?: number;
}

export interface AssetProviderAdapter {
  readonly kind: AssetProviderKind;
  capabilities(): AssetProviderCapabilities;
  defaultBaseUrl(): string;
  termsUrl(): string;
  submit(
    ctx: ProviderContext,
    request: AssetJobRequest,
    imageDataUrl?: string,
  ): Promise<{ providerTaskId: string }>;
  poll(ctx: ProviderContext, providerTaskId: string): Promise<ProviderTaskState>;
  cancel?(ctx: ProviderContext, providerTaskId: string): Promise<void>;
  balance?(ctx: ProviderContext): Promise<number | null>;
  test?(ctx: ProviderContext): Promise<number | null>;
}

const MAX_RETRIES = 4;
const MAX_RETRY_DELAY_MS = 60_000;

export function assetProviderUrl(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

export async function assetProviderJson<T>(
  context: ProviderContext,
  url: string,
  init: RequestInit = {},
): Promise<{ data: T; response: Response }> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await context.fetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${context.apiKey}`,
          accept: 'application/json',
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...Object.fromEntries(new Headers(init.headers).entries()),
        },
        signal: AbortSignal.timeout(context.timeoutMs),
      });
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw providerRequestError(
        error instanceof Error ? error.message : String(error),
        context.apiKey,
        null,
        '',
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (isRetryable(response.status) && attempt < MAX_RETRIES) {
        await delay(retryDelay(response.headers.get('retry-after'), attempt));
        continue;
      }
      throw providerRequestError(`HTTP ${response.status}`, context.apiKey, response.status, body);
    }

    try {
      return { data: (await response.json()) as T, response };
    } catch (error) {
      throw providerRequestError(
        `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`,
        context.apiKey,
        response.status,
        '',
      );
    }
  }
}

export function safeProviderText(value: unknown, apiKey?: string): string {
  if (typeof value !== 'string') return '';
  let message = value.slice(0, 512);
  if (apiKey) message = message.replaceAll(apiKey, '[REDACTED]');
  return redact(message)
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(
      /((?:api[-_]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;}]+/gi,
      '$1[REDACTED]',
    );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelay(header: string | null, attempt: number): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(MAX_RETRY_DELAY_MS, seconds * 1000);
    }
    const date = Date.parse(header);
    if (Number.isFinite(date)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, date - Date.now()));
    }
  }
  return Math.min(MAX_RETRY_DELAY_MS, 500 * 2 ** attempt);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function providerRequestError(
  reason: string,
  apiKey: string,
  status: number | null,
  body: string,
): RpcError {
  const excerpt = safeProviderText(body, apiKey);
  return new RpcError(
    `Asset provider request failed${status === null ? '' : ` (HTTP ${status})`}: ${safeProviderText(reason, apiKey)}${excerpt ? `: ${excerpt}` : ''}`,
    RpcErrorCode.AssetProviderRequestFailed,
    { status, body: excerpt },
  );
}
