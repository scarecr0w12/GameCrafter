import { randomUUID } from 'node:crypto';
import {
  McpProtocolError,
  McpTransportError,
  type JsonRpcId,
  type JsonRpcMessage,
  type McpTransport,
} from './types';

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
  removeAbort?: () => void;
}

export type ServerRequestHandler = (
  params: unknown,
  requestId: JsonRpcId,
) => unknown | Promise<unknown>;

export type ServerNotificationHandler = (params: unknown) => void | Promise<void>;

export class JsonRpcChannel {
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly requestHandlers = new Map<string, ServerRequestHandler>();
  private readonly notificationHandlers = new Map<string, Set<ServerNotificationHandler>>();
  private readonly connectionErrorHandlers = new Set<(error: Error) => void>();
  private closed = false;

  constructor(
    private readonly transport: McpTransport,
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
    if (this.closed) return Promise.reject(new McpTransportError('MCP connection is closed'));
    if (options.signal?.aborted) {
      return Promise.reject(abortError(options.signal.reason));
    }
    const id = randomUUID();
    const request: JsonRpcMessage = { jsonrpc: '2.0', id, method };
    if (params !== undefined) request.params = params;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.finishRequest(id);
        reject(new McpTransportError(`MCP request timed out: ${method}`));
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
        current.reject(asError(error));
      });
    });
  }

  async notify(method: string, params?: unknown): Promise<void> {
    if (this.closed) throw new McpTransportError('MCP connection is closed');
    const notification: JsonRpcMessage = { jsonrpc: '2.0', method };
    if (params !== undefined) notification.params = params;
    await this.transport.send(notification);
  }

  onRequest(method: string, handler: ServerRequestHandler): () => void {
    this.requestHandlers.set(method, handler);
    return () => {
      if (this.requestHandlers.get(method) === handler) this.requestHandlers.delete(method);
    };
  }

  onNotification(method: string, handler: ServerNotificationHandler): () => void {
    const handlers = this.notificationHandlers.get(method) ?? new Set<ServerNotificationHandler>();
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
    this.failPending(new McpTransportError('MCP connection closed'));
    await this.transport.close();
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.jsonrpc !== '2.0') {
      this.failPending(new McpProtocolError('Invalid JSON-RPC version from MCP server', -32600));
      return;
    }
    if (typeof message.method === 'string') {
      if ('id' in message && (typeof message.id === 'string' || typeof message.id === 'number')) {
        void this.handleServerRequest(message.method, message.id, message.params);
      } else {
        this.handleServerNotification(message.method, message.params);
      }
      return;
    }
    if (!('id' in message) || (typeof message.id !== 'string' && typeof message.id !== 'number')) {
      this.failPending(
        new McpProtocolError('Invalid JSON-RPC response id from MCP server', -32600),
      );
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.finishRequest(message.id);
    if (isRecord(message.error)) {
      pending.reject(
        new McpProtocolError(
          typeof message.error.message === 'string' ? message.error.message : 'MCP request failed',
          typeof message.error.code === 'number' ? message.error.code : -32603,
          message.error.data,
        ),
      );
      return;
    }
    if (!('result' in message)) {
      pending.reject(new McpProtocolError('Invalid JSON-RPC response from MCP server', -32600));
      return;
    }
    pending.resolve(message.result);
  }

  private async handleServerRequest(method: string, id: JsonRpcId, params: unknown): Promise<void> {
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
        error instanceof McpProtocolError
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

  private handleServerNotification(method: string, params: unknown): void {
    for (const handler of this.notificationHandlers.get(method) ?? []) {
      void Promise.resolve(handler(params)).catch(() => undefined);
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

function asError(error: unknown): Error {
  return error instanceof Error ? error : new McpTransportError(String(error));
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'MCP request aborted' : String(reason));
  error.name = 'AbortError';
  return error;
}
