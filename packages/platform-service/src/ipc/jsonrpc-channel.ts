import { randomUUID } from 'node:crypto';
import {
  JsonRpcProtocolError,
  JsonRpcTransportError,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcTransport,
} from './types';

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
  removeAbort?: () => void;
}

export type PeerRequestHandler = (
  params: unknown,
  requestId: JsonRpcId,
) => unknown | Promise<unknown>;

export type PeerNotificationHandler = (params: unknown) => void | Promise<void>;

export class JsonRpcChannel {
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly requestHandlers = new Map<string, PeerRequestHandler>();
  private readonly notificationHandlers = new Map<string, Set<PeerNotificationHandler>>();
  private readonly connectionErrorHandlers = new Set<(error: Error) => void>();
  private closed = false;

  constructor(
    private readonly transport: JsonRpcTransport,
    private readonly defaultTimeoutMs: number,
  ) {}

  async start(): Promise<void> {
    await this.transport.start(
      (message) => this.handleMessage(message),
      (error) => this.handleTransportError(error),
    );
  }

  request(
    method: string,
    params?: unknown,
    options: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<unknown> {
    if (this.closed)
      return Promise.reject(new JsonRpcTransportError('JSON-RPC connection is closed'));
    if (options.signal?.aborted) return Promise.reject(abortError(options.signal.reason));
    const id = randomUUID();
    const request: JsonRpcMessage = { jsonrpc: '2.0', id, method };
    if (params !== undefined) request.params = params;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.finishRequest(id);
        reject(new JsonRpcTransportError(`JSON-RPC request timed out: ${method}`));
      }, options.timeoutMs ?? this.defaultTimeoutMs);
      timeout.unref?.();
      const pending: PendingRequest = { resolve, reject, timeout };
      if (options.signal) {
        const onAbort = () => {
          this.finishRequest(id);
          reject(abortError(options.signal?.reason));
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
        pending.removeAbort = () => options.signal?.removeEventListener('abort', onAbort);
      }
      this.pending.set(id, pending);
      void this.transport.send(request, { signal: options.signal }).catch((error: unknown) => {
        const current = this.pending.get(id);
        if (!current) return;
        this.finishRequest(id);
        current.reject(asTransportError(error));
      });
    });
  }

  async notify(method: string, params?: unknown): Promise<void> {
    if (this.closed) throw new JsonRpcTransportError('JSON-RPC connection is closed');
    const notification: JsonRpcMessage = { jsonrpc: '2.0', method };
    if (params !== undefined) notification.params = params;
    await this.transport.send(notification);
  }

  onRequest(method: string, handler: PeerRequestHandler): () => void {
    this.requestHandlers.set(method, handler);
    return () => {
      if (this.requestHandlers.get(method) === handler) this.requestHandlers.delete(method);
    };
  }

  onNotification(method: string, handler: PeerNotificationHandler): () => void {
    const handlers = this.notificationHandlers.get(method) ?? new Set<PeerNotificationHandler>();
    handlers.add(handler);
    this.notificationHandlers.set(method, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.notificationHandlers.delete(method);
    };
  }

  onConnectionError(handler: (error: Error) => void): () => void {
    this.connectionErrorHandlers.add(handler);
    return () => this.connectionErrorHandlers.delete(handler);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.failPending(new JsonRpcTransportError('JSON-RPC connection closed'));
    await this.transport.close();
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.jsonrpc !== '2.0') {
      this.failPending(new JsonRpcProtocolError('Invalid JSON-RPC version', -32600));
      return;
    }
    if (typeof message.method === 'string') {
      if ('id' in message && (typeof message.id === 'string' || typeof message.id === 'number')) {
        void this.handlePeerRequest(message.method, message.id, message.params).catch((error) =>
          this.handleTransportError(asTransportError(error)),
        );
      } else {
        this.handlePeerNotification(message.method, message.params);
      }
      return;
    }
    if (!('id' in message) || (typeof message.id !== 'string' && typeof message.id !== 'number')) {
      this.failPending(new JsonRpcProtocolError('Invalid JSON-RPC response id', -32600));
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.finishRequest(message.id);
    if (isRecord(message.error)) {
      pending.reject(
        new JsonRpcProtocolError(
          typeof message.error.message === 'string'
            ? message.error.message
            : 'JSON-RPC request failed',
          typeof message.error.code === 'number' ? message.error.code : -32603,
          message.error.data,
        ),
      );
      return;
    }
    if (!('result' in message)) {
      pending.reject(new JsonRpcProtocolError('Invalid JSON-RPC response', -32600));
      return;
    }
    pending.resolve(message.result);
  }

  private async handlePeerRequest(method: string, id: JsonRpcId, params: unknown): Promise<void> {
    const handler = this.requestHandlers.get(method);
    if (!handler) {
      await this.sendError(id, -32601, `Method not found: ${method}`, method);
      return;
    }
    try {
      const result = await handler(params, id);
      await this.transport.send(
        { jsonrpc: '2.0', id, result: result ?? {} },
        { rpcMethod: method },
      );
    } catch (error) {
      const code =
        error instanceof JsonRpcProtocolError
          ? error.code
          : isRecord(error) && typeof error.code === 'number'
            ? error.code
            : -32603;
      await this.sendError(
        id,
        code,
        error instanceof Error ? error.message : String(error),
        method,
      );
    }
  }

  private handlePeerNotification(method: string, params: unknown): void {
    for (const handler of this.notificationHandlers.get(method) ?? []) {
      try {
        void Promise.resolve(handler(params)).catch(() => undefined);
      } catch {
        // Subscribers run synchronously for cache invalidation; one failure must not escape dispatch.
      }
    }
  }

  private async sendError(
    id: JsonRpcId,
    code: number,
    message: string,
    rpcMethod?: string,
  ): Promise<void> {
    await this.transport.send(
      { jsonrpc: '2.0', id, error: { code, message } },
      rpcMethod === undefined ? undefined : { rpcMethod },
    );
  }

  private handleTransportError(error: Error): void {
    if (this.closed) return;
    this.failPending(error);
    for (const handler of this.connectionErrorHandlers) handler(error);
  }

  private failPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      this.finishRequest(id);
      pending.reject(error);
    }
  }

  private finishRequest(id: JsonRpcId): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pending.removeAbort?.();
    this.pending.delete(id);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTransportError(error: unknown): Error {
  return error instanceof Error ? error : new JsonRpcTransportError(String(error));
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'JSON-RPC request aborted' : String(reason));
  error.name = 'AbortError';
  return error;
}
