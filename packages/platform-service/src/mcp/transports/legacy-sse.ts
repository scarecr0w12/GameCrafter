import { TextDecoder } from 'node:util';
import { McpTransportError, type JsonRpcMessage, type McpTransport } from '../types';

const maxFrameBytes = 1024 * 1024;

export interface LegacySseTransportOptions {
  url: string;
  headers: Record<string, string>;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class LegacySseTransport implements McpTransport {
  readonly kind = 'legacy-sse';
  readonly legacy = true;
  private onMessage?: (message: JsonRpcMessage) => void;
  private onError?: (error: Error) => void;
  private revision?: string;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private streamTask?: Promise<void>;
  private controller?: AbortController;
  private closed = false;
  private readonly fetchImpl: typeof fetch;
  private endpointResolve?: (url: string) => void;
  private endpointReject?: (error: Error) => void;
  private endpointReady?: Promise<string>;

  constructor(private readonly options: LegacySseTransportOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onError = onError;
    this.controller = new AbortController();
    this.endpointReady = new Promise<string>((resolve, reject) => {
      this.endpointResolve = resolve;
      this.endpointReject = reject;
    });
    const timer = setTimeout(
      () => this.controller?.abort(new Error('Legacy MCP SSE connect timed out')),
      this.options.requestTimeoutMs,
    );
    timer.unref?.();
    try {
      const response = await this.fetchImpl(this.options.url, {
        method: 'GET',
        headers: { ...this.options.headers, Accept: 'text/event-stream' },
        signal: this.controller.signal,
      });
      if (!response.ok)
        throw new McpTransportError(`Legacy MCP SSE connect failed (${response.status})`);
      if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
        throw new McpTransportError('Legacy MCP SSE endpoint did not return text/event-stream');
      }
      if (!response.body) throw new McpTransportError('Legacy MCP SSE response has no body');
      this.reader = response.body.getReader();
      this.streamTask = this.consumeEvents(this.reader, this.controller.signal, true);
      void this.streamTask.catch((error: unknown) => {
        const asFailure = asError(error);
        this.endpointReject?.(asFailure);
        if (!this.closed) this.onError?.(asFailure);
      });
      await this.endpointReady;
    } catch (error) {
      if (this.controller.signal.aborted) {
        const reason = this.controller.signal.reason;
        throw reason instanceof Error ? reason : abortError(reason);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  configure(revision: string | null, _sessionId: string | null, _connectionName: string): void {
    void _sessionId;
    void _connectionName;
    this.revision = revision ?? undefined;
  }

  async send(
    message: JsonRpcMessage,
    options: { signal?: AbortSignal; rpcMethod?: string } = {},
  ): Promise<void> {
    if (this.closed) throw new McpTransportError('Legacy MCP SSE transport is closed');
    const messageUrl = await this.endpointReady;
    if (!messageUrl) throw new McpTransportError('Legacy MCP SSE endpoint is not available');
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new Error('Legacy MCP SSE request timed out')),
      this.options.requestTimeoutMs,
    );
    timer.unref?.();
    try {
      const response = await this.fetchImpl(messageUrl, {
        method: 'POST',
        headers: this.headersFor(message),
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      if (!response.ok) {
        const excerpt = await response.text().catch(() => '');
        throw new McpTransportError(
          `Legacy MCP SSE request failed (${response.status}): ${excerpt.slice(0, 500)}`,
        );
      }
      if (response.status === 202 || response.status === 204) return;
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (contentType.includes('application/json')) {
        const value: unknown = await response.json();
        this.emitMessage(value);
        return;
      }
      if (contentType.includes('text/event-stream') && response.body) {
        await this.consumeEvents(response.body.getReader(), controller.signal, false);
        return;
      }
      const body = await response.text().catch(() => '');
      if (body.trim())
        throw new McpTransportError(`Unexpected legacy SSE POST response: ${body.slice(0, 300)}`);
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        throw reason instanceof Error ? reason : abortError(reason);
      }
      throw error instanceof McpTransportError
        ? error
        : new McpTransportError(`Legacy MCP SSE request failed: ${asError(error).message}`, {
            cause: error,
          });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.controller?.abort('MCP transport closed');
    await this.reader?.cancel().catch(() => undefined);
    await this.streamTask?.catch(() => undefined);
  }

  private headersFor(_message: JsonRpcMessage): Headers {
    void _message;
    const headers = new Headers(this.options.headers);
    headers.set('Accept', 'application/json, text/event-stream');
    headers.set('Content-Type', 'application/json');
    if (this.revision === '2025-06-18' || this.revision === '2025-11-25') {
      headers.set('MCP-Protocol-Version', this.revision);
    }
    return headers;
  }

  private async consumeEvents(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal,
    persistent: boolean,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    const onAbort = () => void reader.cancel(signal.reason).catch(() => undefined);
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        if (Buffer.byteLength(buffer, 'utf8') > maxFrameBytes) {
          throw new McpTransportError('Legacy MCP SSE event exceeds the size limit');
        }
        let separator = buffer.search(/\r?\n\r?\n/);
        while (separator >= 0) {
          const frame = buffer.slice(0, separator);
          const match = buffer.slice(separator).match(/^\r?\n\r?\n/);
          buffer = buffer.slice(separator + (match?.[0].length ?? 2));
          this.readFrame(frame);
          separator = buffer.search(/\r?\n\r?\n/);
        }
        if (done) break;
      }
      if (buffer.trim()) this.readFrame(buffer);
      if (!this.closed && persistent)
        this.onError?.(new McpTransportError('Legacy MCP SSE stream closed'));
    } finally {
      signal.removeEventListener('abort', onAbort);
      reader.releaseLock();
    }
  }

  private readFrame(frame: string): void {
    let event = 'message';
    const data: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    const value = data.join('\n');
    if (!value) return;
    if (event === 'endpoint') {
      try {
        this.endpointResolve?.(new URL(value, this.options.url).toString());
      } catch (error) {
        this.endpointReject?.(
          new McpTransportError(`Invalid legacy SSE endpoint: ${asError(error).message}`),
        );
      }
      return;
    }
    try {
      this.emitMessage(JSON.parse(value));
    } catch (error) {
      this.onError?.(
        new McpTransportError(`Invalid legacy SSE JSON-RPC frame: ${asError(error).message}`),
      );
    }
  }

  private emitMessage(value: unknown): void {
    if (Array.isArray(value)) {
      for (const message of value) this.emitMessage(message);
      return;
    }
    if (typeof value !== 'object' || value === null) {
      this.onError?.(new McpTransportError('Legacy MCP SSE message must be a JSON-RPC object'));
      return;
    }
    this.onMessage?.(value as JsonRpcMessage);
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'Legacy MCP SSE request aborted' : String(reason));
  error.name = 'AbortError';
  return error;
}
