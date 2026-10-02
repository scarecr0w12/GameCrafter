import { spawn } from 'node:child_process';
import net from 'node:net';
import { execCommand } from '../processes/exec-command';
import { RpcError, RpcErrorCode, type McpConnectionConfig } from '@gamecrafter/contracts';
import type { McpTransport } from './types';
import { StdioTransport } from './transports/stdio';
import { StreamableHttpTransport } from './transports/streamable-http';

const execFileAsync = execCommand;

type DockerConfig = Extract<McpConnectionConfig, { mode: 'docker' }>['docker'];

export interface DockerRuntimeOptions {
  connectionId: string;
  connectionName: string;
  docker: DockerConfig;
  env: Record<string, string>;
  headers?: Record<string, string>;
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  dockerBinary?: string;
  onStderr?: (line: string) => void;
  fetchImpl?: typeof fetch;
  spawnProcess?: typeof spawn;
  execFileAsync?: typeof execFileAsync;
}

export interface DockerRuntime {
  transport: McpTransport;
  containerName: string;
  getContainerId(): Promise<string | null>;
  stop(): Promise<void>;
}

export async function createDockerRuntime(options: DockerRuntimeOptions): Promise<DockerRuntime> {
  const dockerBinary = options.dockerBinary ?? 'docker';
  const exec = options.execFileAsync ?? execFileAsync;
  await ensureDockerImage(dockerBinary, options.docker, exec);
  const containerName = `gamecrafter-mcp-${options.connectionId}`;
  const args = dockerRunArgs(
    containerName,
    options.docker,
    options.docker.transport === 'streamable-http',
  );
  const env = { ...process.env, ...options.env };
  let containerId: string | null = null;
  let transport: McpTransport;

  if (options.docker.transport === 'stdio') {
    transport = new StdioTransport({
      command: dockerBinary,
      args,
      env: options.env,
      onStderr: options.onStderr,
      spawnProcess: options.spawnProcess,
    });
  } else {
    if (options.docker.port === undefined) {
      throw new RpcError(
        'Docker HTTP connections require a container port',
        RpcErrorCode.InvalidParams,
      );
    }
    const result = await runDocker(dockerBinary, args, { env, exec });
    containerId = result.stdout.trim().split(/\s+/)[0] || containerName;
    try {
      await waitForTcp('127.0.0.1', options.docker.port, options.connectTimeoutMs);
    } catch (error) {
      // The runtime has not been returned, so the manager cannot clean up this container.
      try {
        await runDocker(dockerBinary, ['stop', containerId], { env, exec });
      } catch (cleanupError) {
        options.onStderr?.(
          `Failed to stop Docker container after startup failure: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
      throw error;
    }
    const url = `http://127.0.0.1:${options.docker.port}/mcp`;
    transport = new StreamableHttpTransport({
      url,
      connectionName: options.connectionName,
      headers: options.headers ?? {},
      requestTimeoutMs: options.requestTimeoutMs,
      fetchImpl: options.fetchImpl,
      onStreamClosed: options.onStderr
        ? (error) => options.onStderr?.(error?.message ?? 'MCP HTTP stream closed')
        : undefined,
    });
  }

  return {
    transport,
    containerName,
    async getContainerId() {
      if (containerId) return containerId;
      try {
        const result = await runDocker(
          dockerBinary,
          ['inspect', '--format={{.Id}}', containerName],
          {
            env,
            exec,
          },
        );
        containerId = result.stdout.trim() || containerName;
        return containerId;
      } catch {
        return null;
      }
    },
    async stop() {
      const ownedId = containerId ?? containerName;
      try {
        await runDocker(dockerBinary, ['stop', ownedId], { env, exec });
      } catch (error) {
        if (isMissingDocker(error)) throw dockerUnavailable(error);
        throw error;
      }
    },
  };
}

async function ensureDockerImage(
  dockerBinary: string,
  config: DockerConfig,
  exec: typeof execFileAsync,
): Promise<void> {
  if (config.pullPolicy === 'always') {
    await runDocker(dockerBinary, ['pull', config.image], { exec });
    return;
  }
  try {
    await runDocker(dockerBinary, ['image', 'inspect', config.image], { exec });
  } catch (error) {
    if (isMissingDocker(error)) throw dockerUnavailable(error);
    if (config.pullPolicy === 'never') {
      throw new RpcError(
        `Docker image is not available locally: ${config.image}`,
        RpcErrorCode.McpConnectFailed,
      );
    }
    await runDocker(dockerBinary, ['pull', config.image], { exec });
  }
}

function dockerRunArgs(containerName: string, config: DockerConfig, detached = false): string[] {
  const args = [
    'run',
    ...(detached ? ['-d'] : ['-i']),
    '--rm',
    '--name',
    containerName,
    '--network',
    config.network,
  ];
  for (const mount of config.mounts) {
    args.push('-v', `${mount.source}:${mount.target}${mount.readOnly ? ':ro' : ''}`);
  }
  if (config.transport === 'streamable-http') {
    if (config.port === undefined) {
      throw new RpcError(
        'Docker HTTP connections require a container port',
        RpcErrorCode.InvalidParams,
      );
    }
    if (config.network !== 'host') args.push('-p', `127.0.0.1:${config.port}:${config.port}`);
  }
  for (const key of Object.keys(config.env)) args.push('-e', key);
  args.push(config.image, ...config.command);
  return args;
}

async function runDocker(
  dockerBinary: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; exec?: typeof execFileAsync } = {},
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await (options.exec ?? execFileAsync)(dockerBinary, args, {
      env: options.env ?? process.env,
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
    });
  } catch (error) {
    if (isMissingDocker(error)) throw dockerUnavailable(error);
    throw error;
  }
}

async function waitForTcp(host: string, port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        socket.setTimeout(250, () => {
          socket.destroy(new Error('port connect timed out'));
        });
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('error', (error) => reject(error));
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new RpcError(
    `Docker MCP server did not listen on ${host}:${port}: ${lastError?.message ?? 'connection timed out'}`,
    RpcErrorCode.McpConnectFailed,
  );
}

function isMissingDocker(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function dockerUnavailable(error: unknown): RpcError {
  return new RpcError(
    `Docker is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    RpcErrorCode.McpDockerUnavailable,
  );
}
