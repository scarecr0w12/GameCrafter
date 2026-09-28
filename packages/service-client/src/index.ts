import { readFile } from 'node:fs/promises';
import net from 'node:net';
import {
  PROTOCOL_VERSION,
  RpcError,
  type RpcMethodName,
  type RpcNotificationName,
  type RpcNotificationParams,
  type RpcParams,
  type RpcResult,
} from '@gamecrafter/contracts';
import { createMessageConnection, ResponseError } from 'vscode-jsonrpc/node';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { resolveClientPaths } from './paths';

export interface ConnectOptions {
  socketPath: string;
  token: string;
  clientName: string;
  clientVersion: string;
}

export interface ServiceClient {
  readonly sessionId: string;
  call<M extends RpcMethodName>(method: M, params: RpcParams<M>): Promise<RpcResult<M>>;
  onNotification<N extends RpcNotificationName>(
    name: N,
    handler: (params: RpcNotificationParams<N>) => void,
  ): void;
  onClose(handler: () => void): void;
  close(): void;
}

function mapRpcError(error: unknown): Error {
  if (error instanceof RpcError) return error;
  if (error instanceof ResponseError) {
    return new RpcError(
      error.message,
      error.code as ConstructorParameters<typeof RpcError>[1],
      error.data,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function connect(options: ConnectOptions): Promise<ServiceClient> {
  const socket = net.connect(options.socketPath);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      socket.removeListener('connect', onConnect);
      reject(error);
    };
    const onConnect = () => {
      socket.removeListener('error', onError);
      resolve();
    };
    socket.once('connect', onConnect);
    socket.once('error', onError);
  });
  const connection = createMessageConnection(
    new StreamMessageReader(socket),
    new StreamMessageWriter(socket),
  );
  connection.listen();

  let hello: RpcResult<'session/hello'>;
  try {
    hello = await connection.sendRequest('session/hello', {
      token: options.token,
      clientName: options.clientName,
      clientVersion: options.clientVersion,
      protocolVersion: PROTOCOL_VERSION,
    });
  } catch (error) {
    connection.dispose();
    socket.destroy();
    throw mapRpcError(error);
  }

  return {
    sessionId: hello.sessionId,
    async call<M extends RpcMethodName>(method: M, params: RpcParams<M>): Promise<RpcResult<M>> {
      try {
        return (await connection.sendRequest(method, params)) as RpcResult<M>;
      } catch (error) {
        throw mapRpcError(error);
      }
    },
    onNotification(name, handler) {
      connection.onNotification(name, handler);
    },
    onClose(handler) {
      connection.onClose(handler);
    },
    close() {
      connection.dispose();
      socket.end();
    },
  };
}

export async function discover(
  env?: NodeJS.ProcessEnv,
): Promise<{ socketPath: string; token: string }> {
  const paths = resolveClientPaths(env);
  const token = (await readFile(paths.tokenPath, 'utf8')).trim();
  return { socketPath: paths.socketPath, token };
}

export { resolveClientPaths } from './paths';
