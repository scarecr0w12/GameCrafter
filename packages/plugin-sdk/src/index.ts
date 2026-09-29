import { randomUUID } from 'node:crypto';
import type { Readable, Writable } from 'node:stream';
import type { AccessMode } from '@gamecrafter/contracts';

const PLUGIN_PROTOCOL_VERSION: typeof import('@gamecrafter/contracts').PLUGIN_PROTOCOL_VERSION = 1;

export interface PluginToolContext {
  taskId: string | null;
  agentRole: string | null;
  accessMode: AccessMode;
}

export interface PluginHost {
  readonly scratchDir: string;
  callTool(toolId: string, input: unknown): Promise<unknown>;
  log(level: 'debug' | 'info' | 'warning' | 'error', message: string): Promise<void>;
  complete(request: unknown): Promise<unknown>;
  getSecret(name: string): Promise<string | undefined>;
  board: {
    read(input: unknown): Promise<unknown>;
    post(input: unknown): Promise<unknown>;
  };
}

export interface PluginToolResult {
  output: unknown;
  evidence?: Array<{ kind: string; ref: string }>;
}

export interface PluginDefinition {
  tools: Record<
    string,
    {
      handler(
        input: unknown,
        host: PluginHost,
        context: PluginToolContext,
      ): unknown | PluginToolResult | Promise<unknown | PluginToolResult>;
    }
  >;
  onSettingsChanged?(settings: Record<string, unknown>): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
}

export interface PluginStreams {
  stdin: Readable;
  stdout: Writable;
}

export interface PluginProgram {
  run(): Promise<void>;
}

interface PendingHostCall {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export function definePlugin(
  definition: PluginDefinition,
  streams: PluginStreams = { stdin: process.stdin, stdout: process.stdout },
): PluginProgram {
  const pendingHostCalls = new Map<string | number, PendingHostCall>();
  const toolIds = Object.keys(definition.tools).sort();
  let scratchDir = '';
  let initialized = false;
  let running = false;
  let lineBuffer = '';
  let finishRun: (() => void) | undefined;
  let failRun: ((error: Error) => void) | undefined;
  const inflight = new Set<Promise<void>>();

  const host: PluginHost = {
    get scratchDir() {
      return scratchDir;
    },
    callTool: (toolId, input) => callHost('host/tool/call', { toolId, input }),
    log: (level, message) => callHost('host/log', { level, message }).then(() => undefined),
    complete: (request) => callHost('host/model/complete', { request }),
    getSecret: async (name) => {
      const value = await callHost('host/secret/get', { name });
      return typeof value === 'string' ? value : undefined;
    },
    board: {
      read: (input) => callHost('host/board/read', input),
      post: (input) => callHost('host/board/post', input),
    },
  };

  return {
    async run(): Promise<void> {
      if (running) throw new Error('Plugin worker has already started');
      running = true;
      await new Promise<void>((resolve, reject) => {
        finishRun = resolve;
        failRun = reject;
        streams.stdin.on('data', onData);
        streams.stdin.once('end', onEnd);
        streams.stdin.once('error', onError);
      });
    },
  };

  function callHost(method: string, params: unknown): Promise<unknown> {
    if (!initialized) return Promise.reject(new Error('Plugin host is not initialized'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      pendingHostCalls.set(id, { resolve, reject });
      void writeMessage(streams.stdout, { jsonrpc: '2.0', id, method, params }).catch(
        (error: unknown) => {
          pendingHostCalls.delete(id);
          reject(asError(error));
        },
      );
    });
  }

  function onData(chunk: Buffer | string): void {
    lineBuffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (Buffer.byteLength(lineBuffer, 'utf8') > 10 * 1024 * 1024) {
      fail(new Error('Plugin host frame exceeds the size limit'));
      return;
    }
    for (;;) {
      const newline = lineBuffer.indexOf('\n');
      if (newline < 0) return;
      const line = lineBuffer.slice(0, newline).trim();
      lineBuffer = lineBuffer.slice(newline + 1);
      if (!line) continue;
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch (error) {
        fail(new Error(`Invalid JSON-RPC frame from host: ${asError(error).message}`));
        return;
      }
      const operation = handleMessage(message);
      inflight.add(operation);
      void operation.finally(() => {
        inflight.delete(operation);
      });
    }
  }

  async function handleMessage(value: unknown): Promise<void> {
    if (!isRecord(value) || value.jsonrpc !== '2.0') {
      fail(new Error('Invalid JSON-RPC message from host'));
      return;
    }
    if (typeof value.method === 'string') {
      const hasId = typeof value.id === 'string' || typeof value.id === 'number';
      if (!hasId) {
        if (value.method === 'plugin/settingsChanged') {
          try {
            const params = isRecord(value.params) ? value.params : {};
            await definition.onSettingsChanged?.(isRecord(params.settings) ? params.settings : {});
          } catch {
            return;
          }
        }
        return;
      }
      const id = value.id as string | number;
      try {
        const result = await handleHostRequest(value.method, value.params);
        await writeMessage(streams.stdout, { jsonrpc: '2.0', id, result: result ?? {} });
        if (value.method === 'plugin/shutdown') finish();
      } catch (error) {
        const code = error instanceof PluginSdkError ? error.code : -32603;
        await writeMessage(streams.stdout, {
          jsonrpc: '2.0',
          id,
          error: { code, message: asError(error).message },
        });
      }
      return;
    }
    if (typeof value.id !== 'string' && typeof value.id !== 'number') {
      fail(new Error('Invalid JSON-RPC response id from host'));
      return;
    }
    const pending = pendingHostCalls.get(value.id);
    if (!pending) return;
    pendingHostCalls.delete(value.id);
    if (isRecord(value.error)) {
      pending.reject(
        new PluginSdkError(
          typeof value.error.message === 'string' ? value.error.message : 'Plugin host call failed',
          typeof value.error.code === 'number' ? value.error.code : -32603,
        ),
      );
    } else if ('result' in value) {
      pending.resolve(value.result);
    } else {
      pending.reject(new PluginSdkError('Invalid JSON-RPC response from host', -32600));
    }
  }

  async function handleHostRequest(method: string, params: unknown): Promise<unknown> {
    if (method === 'plugin/initialize') {
      const input = isRecord(params) ? params : {};
      if (input.protocolVersion !== PLUGIN_PROTOCOL_VERSION) {
        throw new PluginSdkError('Unsupported plugin protocol version', -32088);
      }
      scratchDir = typeof input.scratchDir === 'string' ? input.scratchDir : '';
      await definition.onSettingsChanged?.(isRecord(input.settings) ? input.settings : {});
      initialized = true;
      return { protocolVersion: PLUGIN_PROTOCOL_VERSION, tools: toolIds };
    }
    if (!initialized) throw new PluginSdkError('Plugin worker has not been initialized', -32086);
    if (method === 'ping') return {};
    if (method === 'plugin/tool/call') {
      const input = isRecord(params) ? params : {};
      const toolId = typeof input.toolId === 'string' ? input.toolId : '';
      const tool = definition.tools[toolId];
      if (!tool) throw new PluginSdkError(`Plugin tool not found: ${toolId}`, -32601);
      const context = parseContext(input.context);
      const result = await tool.handler(input.input, host, context);
      if (isPluginToolResult(result)) {
        return {
          output: result.output,
          ...(result.evidence === undefined ? {} : { evidence: result.evidence }),
        };
      }
      return { output: result };
    }
    if (method === 'plugin/shutdown') {
      await definition.onShutdown?.();
      return {};
    }
    throw new PluginSdkError(`Method not found: ${method}`, -32601);
  }

  function onEnd(): void {
    if (inflight.size === 0) finish();
    else void Promise.allSettled([...inflight]).then(finish);
  }

  function onError(error: Error): void {
    fail(error);
  }

  function finish(): void {
    streams.stdin.off('data', onData);
    streams.stdin.off('end', onEnd);
    streams.stdin.off('error', onError);
    for (const pending of pendingHostCalls.values())
      pending.reject(new Error('Plugin worker stopped'));
    pendingHostCalls.clear();
    finishRun?.();
  }

  function fail(error: Error): void {
    streams.stdin.off('data', onData);
    streams.stdin.off('end', onEnd);
    streams.stdin.off('error', onError);
    for (const pending of pendingHostCalls.values()) pending.reject(error);
    pendingHostCalls.clear();
    failRun?.(error);
  }
}

export class PluginSdkError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
    this.name = 'PluginSdkError';
  }
}

async function writeMessage(stream: Writable, message: unknown): Promise<void> {
  const frame = `${JSON.stringify(message)}\n`;
  await new Promise<void>((resolve, reject) => {
    stream.write(frame, (error) => (error ? reject(error) : resolve()));
  });
}

function parseContext(value: unknown): PluginToolContext {
  if (!isRecord(value)) throw new PluginSdkError('Plugin tool context is missing', -32602);
  const accessMode = value.accessMode;
  if (accessMode !== 'full' && accessMode !== 'restricted' && accessMode !== 'ask-always') {
    throw new PluginSdkError('Plugin tool access mode is invalid', -32602);
  }
  return {
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    agentRole: typeof value.agentRole === 'string' ? value.agentRole : null,
    accessMode,
  };
}

function isPluginToolResult(value: unknown): value is PluginToolResult {
  return isRecord(value) && 'output' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
