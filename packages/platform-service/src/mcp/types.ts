import {
  JsonRpcProtocolError,
  JsonRpcTransportError,
  type JsonRpcTransport,
  type JsonRpcTransportErrorOptions,
} from '../ipc/types';
export type { JsonRpcId, JsonRpcMessage } from '../ipc/types';

export interface McpTransport extends JsonRpcTransport {
  readonly kind: string;
  readonly legacy: boolean;
  configure?(revision: string | null, sessionId: string | null, connectionName: string): void;
  setStreamClosedHandler?(handler: (error?: Error) => void): void;
  openNotificationStream?(methods: string[], signal?: AbortSignal): Promise<void>;
}

export interface McpLogEntry {
  at: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
}

export class McpProtocolError extends JsonRpcProtocolError {
  constructor(message: string, code: number, data?: unknown, httpStatus?: number) {
    super(message, code, data, httpStatus);
    this.name = 'McpProtocolError';
  }
}

export type McpTransportErrorOptions = JsonRpcTransportErrorOptions;

export class McpTransportError extends JsonRpcTransportError {
  constructor(message: string, options?: McpTransportErrorOptions) {
    super(message, options);
    this.name = 'McpTransportError';
  }
}
