export type JsonRpcId = string | number;
export type JsonRpcMessage = Record<string, unknown>;

export interface JsonRpcTransport {
  start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void>;
  send(
    message: JsonRpcMessage,
    options?: { signal?: AbortSignal; rpcMethod?: string },
  ): Promise<void>;
  close(): Promise<void>;
}

export class JsonRpcProtocolError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'JsonRpcProtocolError';
  }
}

export interface JsonRpcTransportErrorOptions extends ErrorOptions {
  httpStatus?: number;
}

export class JsonRpcTransportError extends Error {
  readonly httpStatus?: number;

  constructor(message: string, options?: JsonRpcTransportErrorOptions) {
    super(message, options);
    this.name = 'JsonRpcTransportError';
    this.httpStatus = options?.httpStatus;
  }
}
