export type JsonRpcId = string | number;
export type JsonRpcMessage = Record<string, unknown>;

export interface McpTransport {
  readonly kind: string;
  readonly legacy: boolean;
  start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void>;
  send(
    message: JsonRpcMessage,
    options?: { signal?: AbortSignal; rpcMethod?: string },
  ): Promise<void>;
  close(): Promise<void>;
  configure?(revision: string | null, sessionId: string | null, connectionName: string): void;
  setStreamClosedHandler?(handler: (error?: Error) => void): void;
  openNotificationStream?(methods: string[], signal?: AbortSignal): Promise<void>;
}

export interface McpLogEntry {
  at: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
}

export class McpProtocolError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'McpProtocolError';
  }
}

export interface McpTransportErrorOptions extends ErrorOptions {
  httpStatus?: number;
}

export class McpTransportError extends Error {
  readonly httpStatus?: number;

  constructor(message: string, options?: McpTransportErrorOptions) {
    super(message, options);
    this.name = 'McpTransportError';
    this.httpStatus = options?.httpStatus;
  }
}
