import {
  McpProtocolError,
  McpTransportError,
  type JsonRpcMessage,
  type McpTransport,
} from '../types';

export interface StreamableHttpTransportOptions {
  url: string;
  connectionName: string;
  headers: Record<string, string>;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
  onStreamClosed?: (error?: Error) => void;
}

const maxEventBytes = 1024 * 1024;

export class StreamableHttpTransport implements McpTransport {
  readonly kind = 'streamable-http';
  readonly legacy = false;
  private onMessage?: (message: JsonRpcMessage) => void;
  private onError?: (error: Error) => void;
  private revision?: string;
  private sessionId: string | null = null;
  private closed = false;
  private readonly controllers = new Set<AbortController>();
  private readonly streams = new Set<Promise<void>>();
  private readonly fetchImpl: typeof fetch;
  private streamClosedHandler?: (error?: Error) => void;

  constructor(private readonly options: StreamableHttpTransportOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onError = onError;
  }

  configure(revision: string | null, sessionId: string | null, _connectionName: string): void {
    void _connectionName;
    this.revision = revision ?? undefined;
    if (revision === null || revision === '2026-07-28') {
      this.sessionId = null;
    } else if (sessionId !== null) {
      this.sessionId = sessionId;
    }
  }

  setStreamClosedHandler(handler: (error?: Error) => void): void {
    this.streamClosedHandler = handler;
  }

  async send(
    message: JsonRpcMessage,
    options: { signal?: AbortSignal; rpcMethod?: string } = {},
  ): Promise<void> {
    if (this.closed) throw new McpTransportError('MCP HTTP transport is closed');
    if (options.signal?.aborted) throw abortError(options.signal.reason);
    const controller = new AbortController();
    this.controllers.add(controller);
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new Error('MCP HTTP request timed out')),
      this.options.requestTimeoutMs,
    );
    timeout.unref?.();
    let streaming = false;
    try {
      const response = await this.fetchImpl(this.options.url, {
        method: 'POST',
        headers: this.headersFor(message, false, options.rpcMethod),
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const protocolError = parseJsonRpcError(body, response.status);
        if (protocolError) throw protocolError;
        throw new McpTransportError(
          `MCP HTTP request failed (${response.status}): ${body.slice(0, 500)}`,
          { httpStatus: response.status },
        );
      }
      const responseSessionId = response.headers.get('mcp-session-id');
      if (responseSessionId && this.revision !== '2026-07-28') this.sessionId = responseSessionId;
      if (response.status === 202 || response.status === 204) return;
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (contentType.includes('text/event-stream')) {
        if (!response.body) throw new McpTransportError('MCP HTTP SSE response has no body');
        streaming = true;
        const stream = this.consumeSse(response.body, controller.signal);
        this.streams.add(stream);
        void stream
          .catch((error: unknown) => this.reportStreamClosed(asError(error)))
          .finally(() => {
            this.streams.delete(stream);
            this.controllers.delete(controller);
            options.signal?.removeEventListener('abort', onAbort);
          });
        return;
      }
      if (!contentType.includes('application/json')) {
        const body = await response.text().catch(() => '');
        if (!body.trim()) return;
        throw new McpTransportError(
          `Unexpected MCP HTTP response content type: ${contentType || 'missing'}`,
        );
      }
      const messageValue: unknown = await response.json();
      this.emitJsonRpc(messageValue);
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        throw reason instanceof Error ? reason : abortError(reason);
      }
      throw error instanceof McpTransportError || error instanceof McpProtocolError
        ? error
        : new McpTransportError(`MCP HTTP transport failed: ${asError(error).message}`, {
            cause: error,
          });
    } finally {
      clearTimeout(timeout);
      if (!streaming) {
        this.controllers.delete(controller);
        options.signal?.removeEventListener('abort', onAbort);
      }
    }
  }

  async openNotificationStream(methods: string[], signal?: AbortSignal): Promise<void> {
    if (this.closed) throw new McpTransportError('MCP HTTP transport is closed');
    const controller = new AbortController();
    this.controllers.add(controller);
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new Error('MCP HTTP stream connection timed out')),
      this.options.requestTimeoutMs,
    );
    timeout.unref?.();
    let streaming = false;
    try {
      const response = await this.fetchImpl(this.options.url, {
        method: 'GET',
        headers: this.headersFor({ method: 'notifications/stream' }, true),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) return;
        throw new McpTransportError(`MCP HTTP event stream failed (${response.status})`);
      }
      if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
        throw new McpTransportError('MCP HTTP event stream did not return text/event-stream');
      }
      if (!response.body) throw new McpTransportError('MCP HTTP event stream has no body');
      streaming = true;
      const stream = this.consumeSse(response.body, controller.signal);
      this.streams.add(stream);
      void stream
        .catch((error: unknown) => this.reportStreamClosed(asError(error)))
        .finally(() => {
          this.streams.delete(stream);
          this.controllers.delete(controller);
          signal?.removeEventListener('abort', onAbort);
        });
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        throw reason instanceof Error ? reason : abortError(reason);
      }
      throw error instanceof McpTransportError
        ? error
        : new McpTransportError(`MCP HTTP event stream failed: ${asError(error).message}`, {
            cause: error,
          });
    } finally {
      clearTimeout(timeout);
      if (!streaming) {
        this.controllers.delete(controller);
        signal?.removeEventListener('abort', onAbort);
      }
    }
    void methods;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const controller of this.controllers) controller.abort('MCP transport closed');
    await Promise.allSettled([...this.streams]);
    this.controllers.clear();
    this.streams.clear();
  }

  private headersFor(message: JsonRpcMessage, eventStream = false, rpcMethod?: string): Headers {
    const headers = new Headers(this.options.headers);
    headers.set(
      'Accept',
      eventStream ? 'text/event-stream' : 'application/json, text/event-stream',
    );
    if (!eventStream) headers.set('Content-Type', 'application/json');
    if (this.sessionId && this.revision !== '2026-07-28') {
      headers.set('Mcp-Session-Id', this.sessionId);
    }
    if (this.revision === '2025-06-18' || this.revision === '2025-11-25') {
      headers.set('MCP-Protocol-Version', this.revision);
    }
    if (this.revision === '2026-07-28') {
      headers.set(
        'Mcp-Method',
        rpcMethod ?? (typeof message.method === 'string' ? message.method : 'response'),
      );
      headers.set('Mcp-Name', this.options.connectionName);
    }
    return headers;
  }

  private async consumeSse(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const onAbort = () => void reader.cancel(signal.reason).catch(() => undefined);
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        if (Buffer.byteLength(buffer, 'utf8') > maxEventBytes) {
          throw new McpTransportError('MCP SSE event exceeds the size limit');
        }
        let separator = buffer.search(/\r?\n\r?\n/);
        while (separator >= 0) {
          const frame = buffer.slice(0, separator);
          const matched = buffer.slice(separator).match(/^\r?\n\r?\n/);
          buffer = buffer.slice(separator + (matched?.[0].length ?? 2));
          this.readSseFrame(frame);
          separator = buffer.search(/\r?\n\r?\n/);
        }
        if (done) break;
      }
      if (buffer.trim()) this.readSseFrame(buffer);
      this.reportStreamClosed();
    } finally {
      signal.removeEventListener('abort', onAbort);
      reader.releaseLock();
    }
  }

  private readSseFrame(frame: string): void {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data || data === '[DONE]') return;
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) {
        for (const message of parsed) this.emitJsonRpc(message);
      } else {
        this.emitJsonRpc(parsed);
      }
    } catch (error) {
      this.onError?.(
        new McpTransportError(`Invalid MCP SSE JSON-RPC event: ${asError(error).message}`),
      );
    }
  }

  private emitJsonRpc(value: unknown): void {
    if (Array.isArray(value)) {
      for (const message of value) this.emitJsonRpc(message);
      return;
    }
    if (typeof value !== 'object' || value === null) {
      this.onError?.(new McpTransportError('MCP HTTP returned a non-object JSON-RPC message'));
      return;
    }
    this.onMessage?.(value as JsonRpcMessage);
  }

  private reportStreamClosed(error?: Error): void {
    this.options.onStreamClosed?.(error);
    this.streamClosedHandler?.(error);
  }
}

function parseJsonRpcError(body: string, httpStatus: number): McpProtocolError | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  if (typeof value.error.code !== 'number' || typeof value.error.message !== 'string') {
    return undefined;
  }
  return new McpProtocolError(value.error.message, value.error.code, value.error.data, httpStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'MCP HTTP request aborted' : String(reason));
  error.name = 'AbortError';
  return error;
}
