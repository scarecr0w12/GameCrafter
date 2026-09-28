import { timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, unlinkSync } from 'node:fs';
import net, { type Server, type Socket } from 'node:net';
import {
  compile,
  PROTOCOL_VERSION,
  uuidv7,
  RpcError,
  RpcMethods,
  type RpcMethodName,
  type RpcParams,
  type RpcResult,
  type RpcNotificationName,
  type RpcNotificationParams,
} from '@gamecrafter/contracts';
import { createMessageConnection, ResponseError } from 'vscode-jsonrpc/node';
import type { MessageConnection } from 'vscode-jsonrpc/node';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import type { ServicePaths } from '../paths';

export interface RpcRequestContext {
  sessionId: string;
  notify<N extends RpcNotificationName>(name: N, params: RpcNotificationParams<N>): void;
}

export type RpcHandlers = {
  [M in Exclude<RpcMethodName, 'session/hello'>]: (
    params: RpcParams<M>,
    context: RpcRequestContext,
  ) => RpcResult<M> | Promise<RpcResult<M>>;
};

export interface IpcServerOptions {
  paths: ServicePaths;
  handlers: RpcHandlers;
  token: string;
  serviceVersion?: string;
  onClientEvent?: (event: 'connected' | 'closed') => void;
  onSessionOpened?: (sessionId: string) => void;
  onSessionClosed?: (sessionId: string) => void;
}

interface ClientConnection {
  socket: Socket;
  connection: MessageConnection;
  authenticated: boolean;
  sessionId?: string;
}

type SchemaValidator = ReturnType<typeof compile<unknown>>;

const validators = new Map<RpcMethodName, { params: SchemaValidator; result: SchemaValidator }>();
for (const [method, schema] of Object.entries(RpcMethods)) {
  validators.set(method as RpcMethodName, {
    params: compile<unknown>(schema.params),
    result: compile<unknown>(schema.result),
  });
}

export class IpcServer {
  private server?: Server;
  private readonly clients = new Set<ClientConnection>();

  constructor(private readonly options: IpcServerOptions) {}

  async listen(): Promise<void> {
    const { paths } = this.options;
    if (paths.runtimeDir) {
      mkdirSync(paths.runtimeDir, { recursive: true, mode: 0o700 });
      if (process.platform !== 'win32') chmodSync(paths.runtimeDir, 0o700);
    }
    if (process.platform !== 'win32') {
      try {
        unlinkSync(paths.socketPath);
      } catch (error) {
        if (!isCode(error, 'ENOENT')) throw error;
      }
    }

    this.server = net.createServer((socket) => this.accept(socket));
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(paths.socketPath, () => {
        this.server!.removeListener('error', reject);
        resolve();
      });
    });
    if (process.platform !== 'win32') chmodSync(paths.socketPath, 0o600);
  }

  broadcast<N extends RpcNotificationName>(name: N, params: RpcNotificationParams<N>): void {
    for (const client of this.clients) {
      if (client.authenticated) {
        void client.connection.sendNotification(name, params).catch(() => undefined);
      }
    }
  }

  private notifyClient<N extends RpcNotificationName>(
    client: ClientConnection,
    name: N,
    params: RpcNotificationParams<N>,
  ): void {
    if (!client.authenticated) return;
    void client.connection.sendNotification(name, params).catch(() => undefined);
  }

  async close(): Promise<void> {
    for (const client of this.clients) {
      client.connection.dispose();
      client.socket.destroy();
    }
    this.clients.clear();
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = undefined;
    }
    if (process.platform !== 'win32') {
      try {
        unlinkSync(this.options.paths.socketPath);
      } catch (error) {
        if (!isCode(error, 'ENOENT')) throw error;
      }
    }
  }

  private accept(socket: Socket): void {
    const connection = createMessageConnection(
      new StreamMessageReader(socket),
      new StreamMessageWriter(socket),
    );
    const client: ClientConnection = { socket, connection, authenticated: false };
    this.clients.add(client);
    this.options.onClientEvent?.('connected');

    connection.onRequest('session/hello', (params: unknown) => {
      const validation = validators.get('session/hello')!.params;
      if (!validation.check(params)) {
        throw new ResponseError(
          -32602,
          'Invalid session/hello params',
          validationErrors(validation, params),
        );
      }
      const hello = params as RpcParams<'session/hello'>;
      if (!secureEquals(hello.token, this.options.token)) {
        setTimeout(() => socket.destroy(), 25).unref();
        throw new ResponseError(-32000, 'Unauthenticated');
      }
      if (hello.protocolVersion !== PROTOCOL_VERSION) {
        throw new ResponseError(-32005, 'Protocol version mismatch');
      }
      if (!client.sessionId) {
        const sessionId = uuidv7();
        this.options.onSessionOpened?.(sessionId);
        client.sessionId = sessionId;
      }
      client.authenticated = true;
      return {
        ok: true,
        serviceVersion: this.options.serviceVersion ?? '0.1.0',
        protocolVersion: PROTOCOL_VERSION,
        sessionId: client.sessionId,
      };
    });

    for (const method of Object.keys(RpcMethods) as RpcMethodName[]) {
      if (method === 'session/hello') continue;
      connection.onRequest(method, async (params: unknown) => {
        if (!client.authenticated) {
          setTimeout(() => socket.destroy(), 25).unref();
          throw new ResponseError(-32000, 'Unauthenticated');
        }
        const methodValidators = validators.get(method)!;
        const paramsValidator = methodValidators.params;
        if (!paramsValidator.check(params)) {
          throw new ResponseError(
            -32602,
            `Invalid params for ${method}`,
            validationErrors(paramsValidator, params),
          );
        }
        try {
          const handler = this.options.handlers[method as keyof RpcHandlers] as (
            input: unknown,
            context: RpcRequestContext,
          ) => unknown;
          const result = await handler(params, {
            sessionId: client.sessionId!,
            notify: <N extends RpcNotificationName>(
              name: N,
              notificationParams: RpcNotificationParams<N>,
            ) => this.notifyClient(client, name, notificationParams),
          });
          const resultValidator = methodValidators.result;
          if (!resultValidator.check(result)) {
            throw new ResponseError(
              -32603,
              `Invalid result for ${method}`,
              validationErrors(resultValidator, result),
            );
          }
          return result;
        } catch (error) {
          if (error instanceof ResponseError) throw error;
          if (error instanceof RpcError) {
            throw new ResponseError(error.code, error.message, error.data);
          }
          throw new ResponseError(-32603, error instanceof Error ? error.message : String(error));
        }
      });
    }

    connection.onRequest((method) => {
      if (!client.authenticated) {
        setTimeout(() => socket.destroy(), 25).unref();
        throw new ResponseError(-32000, 'Unauthenticated');
      }
      throw new ResponseError(-32601, `Method not found: ${method}`);
    });

    connection.onClose(() => {
      this.clients.delete(client);
      if (client.sessionId) this.options.onSessionClosed?.(client.sessionId);
      this.options.onClientEvent?.('closed');
    });
    connection.listen();
  }
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validationErrors(validator: { assert(value: unknown): unknown }, value: unknown): unknown {
  try {
    validator.assert(value);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
