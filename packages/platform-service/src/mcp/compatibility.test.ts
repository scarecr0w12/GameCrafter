import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7, type McpConnectionConfig, type McpRevision } from '@gamecrafter/contracts';
import { McpSession } from './session';
import { JsonRpcChannel } from './jsonrpc-channel';
import { startMcp2026HttpFixture } from './__fixtures__/server-2026-07-28';
import { StdioTransport } from './transports/stdio';
import { StreamableHttpTransport } from './transports/streamable-http';
import type { McpTransport } from './types';

const sessions: McpSession[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.disconnect()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const sdkRevisions: McpRevision[] = ['2025-03-26', '2025-06-18', '2025-11-25'];

describe('MCP revision compatibility', () => {
  it.each(sdkRevisions)(
    '%s negotiates over stdio, lists tools, and calls echo',
    async (revision) => {
      const fixture = path.resolve(
        __dirname,
        `../../lib/mcp/__fixtures__/sdk-server-${revision}.js`,
      );
      const elicitation = vi.fn(async () => ({ value: 'accepted' }));
      const { session, logs } = createStdioSession(fixture, revision, {}, elicitation);
      try {
        const state = await session.connect();
        expect(state).toMatchObject({
          negotiatedRevision: revision,
          status: 'connected',
          legacy: true,
        });
        expect((await session.listTools()).tools.map((tool) => tool.name)).toContain('echo');
        const result = await session.callTool('echo', { message: `reply-${revision}` });
        expect(result).toMatchObject({ content: [{ type: 'text', text: `reply-${revision}` }] });
        if (revision === '2025-03-26') {
          await expect(session.callTool('sample', {})).rejects.toMatchObject({ code: -32064 });
          expect(logs.join('\n')).toContain('Refused server-initiated sampling/createMessage');
        } else {
          const elicitationResult = await session.callTool('ask_then_echo', {});
          expect(elicitation).toHaveBeenCalledOnce();
          expect(elicitationResult).toMatchObject({
            content: [{ type: 'text', text: expect.stringContaining('accepted') }],
          });
        }
      } finally {
        await session.disconnect();
      }
    },
  );

  it('negotiates the hand-written 2026 revision over stdio and preserves MRTR requestState on retry', async () => {
    const fixture = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
    const inputRequired = vi.fn(async () => ({ confirmation: 'yes' }));
    const { session } = createStdioSession(fixture, '2026-07-28', [], inputRequired);
    try {
      const state = await session.connect();
      expect(state).toMatchObject({
        negotiatedRevision: '2026-07-28',
        status: 'connected',
        legacy: false,
      });
      const snapshot = await session.listTools();
      expect(snapshot.ttlMs).toBe(60_000);
      const result = await session.callTool('needs_input', { value: 'complete' });
      expect(inputRequired).toHaveBeenCalledWith(
        expect.any(String),
        [{ id: 'confirmation', prompt: 'Continue?', options: ['yes', 'no'] }],
        null,
        null,
        undefined,
      );
      expect(result).toMatchObject({
        resultType: 'complete',
        inputResponses: { confirmation: 'yes' },
        requestState: { opaque: 'fixture-state-42' },
      });
    } finally {
      await session.disconnect();
    }
  });

  it('rejects a 2026 server discover probe with an unsupported _meta revision using -32022', async () => {
    const fixture = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
    const channel = new JsonRpcChannel(
      new StdioTransport({ command: process.execPath, args: [fixture], env: {} }),
      5_000,
    );
    try {
      await channel.start();
      await expect(
        channel.request('server/discover', {
          _meta: { 'io.modelcontextprotocol/protocolVersion': '2025-11-25' },
        }),
      ).rejects.toMatchObject({ code: -32022 });
    } finally {
      await channel.close();
    }
  });

  it('maps an unsupported initialize revision and performs exactly one initialize attempt', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-mcp-unsupported-'));
    directories.push(directory);
    const fixture = path.resolve(
      __dirname,
      '../../lib/mcp/__fixtures__/unsupported-version-server.js',
    );
    const requestsFile = path.join(directory, 'requests.log');
    const { session } = createStdioSession(fixture, '2025-11-25', {
      MCP_FIXTURE_REQUESTS: requestsFile,
    });
    try {
      await expect(session.connect()).rejects.toMatchObject({ code: -32061 });
      const methods = readFileSync(requestsFile, 'utf8').trim().split('\n');
      expect(methods.filter((method) => method === 'server/discover')).toHaveLength(1);
      expect(methods.filter((method) => method === 'initialize')).toHaveLength(1);
    } finally {
      await session.disconnect();
    }
  });

  it.each(sdkRevisions)(
    '%s Streamable HTTP negotiates headers and reuses the session id',
    async (revision) => {
      const directory = mkdtempSync(path.join(tmpdir(), 'gc-mcp-http-'));
      directories.push(directory);
      const headersFile = path.join(directory, 'headers.jsonl');
      const fixtureProcess = await startSdkHttpFixture(revision, headersFile);
      const config = connectionConfig(revision, {
        mode: 'endpoint',
        url: `http://127.0.0.1:${fixtureProcess.port}/mcp`,
      });
      const { session } = createSession(
        config,
        new StreamableHttpTransport({
          url: config.endpoint.url,
          connectionName: config.name,
          headers: {},
          requestTimeoutMs: 5_000,
        }),
      );
      try {
        const state = await session.connect();
        expect(state.negotiatedRevision).toBe(revision);
        expect((await session.callTool('echo', { message: 'http-ok' })).content).toEqual([
          { type: 'text', text: 'http-ok' },
        ]);
        const requests = readFileSync(headersFile, 'utf8')
          .trim()
          .split('\n')
          .map(
            (line) =>
              JSON.parse(line) as {
                headers: Record<string, string>;
                rpcMethod: string | null;
                status: number;
              },
          );
        const headers = requests.map((request) => request.headers);
        const probe = requests.find((request) => request.rpcMethod === 'server/discover');
        expect(probe?.status).toBe(400);
        expect(requests.filter((request) => request.rpcMethod === 'initialize')).toHaveLength(1);
        const initialize = requests.find((request) => request.rpcMethod === 'initialize');
        expect(initialize?.headers['mcp-session-id']).toBeUndefined();
        expect(headers.some((request) => request['mcp-session-id'])).toBe(true);
        if (revision === '2025-03-26') {
          expect(headers.every((request) => request['mcp-protocol-version'] === undefined)).toBe(
            true,
          );
        } else {
          const afterNegotiation = headers.slice(2);
          expect(afterNegotiation.length).toBeGreaterThanOrEqual(3);
          expect(
            afterNegotiation.every((request) => request['mcp-protocol-version'] === revision),
          ).toBe(true);
        }
      } finally {
        await session.disconnect();
        await fixtureProcess.close();
      }
    },
  );

  it('sends the 2026 method/name headers and re-lists after the subscriptions stream closes', async () => {
    const fixture = await startMcp2026HttpFixture();
    const config = connectionConfig('2026-07-28', {
      mode: 'endpoint',
      url: fixture.url,
    });
    const { session } = createSession(
      config,
      new StreamableHttpTransport({
        url: fixture.url,
        connectionName: config.name,
        headers: {},
        requestTimeoutMs: 5_000,
      }),
    );
    try {
      await session.connect();
      const firstListing = fixture.requests.filter(
        (request) => request.headers['mcp-method'] === 'tools/list',
      ).length;
      expect((await session.callTool('echo', { value: 'http-2026' })).content).toMatchObject([
        { type: 'text', text: 'http-2026' },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await session.listTools();
      const latest = fixture.requests.filter(
        (request) => request.headers['mcp-method'] === 'tools/list',
      ).length;
      expect(latest).toBe(firstListing + 1);
      expect(fixture.requests.every((request) => request.headers['mcp-name'] === config.name)).toBe(
        true,
      );
      expect(
        fixture.requests.every((request) => typeof request.headers['mcp-method'] === 'string'),
      ).toBe(true);
      expect(
        fixture.requests.every((request) => request.headers['mcp-protocol-version'] === undefined),
      ).toBe(true);
      expect(
        fixture.requests.every((request) => request.headers['mcp-session-id'] === undefined),
      ).toBe(true);
      expect(
        fixture.requests.some(
          (request) => request.headers['mcp-method'] === 'subscriptions/listen',
        ),
      ).toBe(true);
    } finally {
      await session.disconnect();
      await fixture.close();
    }
  });
});

function createStdioSession(
  fixture: string,
  revision: McpRevision,
  env: Record<string, string> = {},
  onInputRequired?: (
    requestId: string,
    requests: unknown[],
    projectId: string | null,
    taskId: string | null,
    signal?: AbortSignal,
  ) => Promise<unknown>,
): { session: McpSession; logs: string[] } {
  return createSession(
    connectionConfig(revision, {
      mode: 'command',
      command: process.execPath,
      args: [fixture],
      env,
    }),
    new StdioTransport({ command: process.execPath, args: [fixture], env }),
    onInputRequired,
  );
}

function createSession(
  config: McpConnectionConfig,
  transport: McpTransport,
  onInputRequired?: (
    requestId: string,
    requests: unknown[],
    projectId: string | null,
    taskId: string | null,
    signal?: AbortSignal,
  ) => Promise<unknown>,
): { session: McpSession; logs: string[] } {
  const logs: string[] = [];
  const session = new McpSession({
    config,
    transport,
    clientInfo: { name: 'compatibility-test', version: '1.0.0' },
    interactions: {
      onInputRequired,
      log: (entry) => logs.push(entry.message),
    },
  });
  sessions.push(session);
  return { session, logs };
}

function connectionConfig(
  revision: McpRevision,
  connection:
    | { mode: 'command'; command: string; args: string[]; env: Record<string, string> }
    | { mode: 'endpoint'; url: string },
): McpConnectionConfig {
  const timestamp = '2026-09-28T00:00:00.000Z';
  const base = {
    connectionId: uuidv7(),
    name: `fixture-${revision.replaceAll('-', '')}`,
    scope: 'platform' as const,
    projectId: null,
    allowServerInitiatedModelCalls: false,
    enabled: true,
    timeoutsMs: { connect: 5_000, request: 5_000 },
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (connection.mode === 'command') {
    return {
      ...base,
      mode: 'command',
      command: { command: connection.command, args: connection.args, env: connection.env },
    };
  }
  return {
    ...base,
    mode: 'endpoint',
    endpoint: { url: connection.url, transport: 'streamable-http', headers: {} },
  };
}

async function startSdkHttpFixture(
  revision: McpRevision,
  headersFile: string,
): Promise<{ port: number; close(): Promise<void> }> {
  const fixture = path.resolve(__dirname, `../../lib/mcp/__fixtures__/sdk-server-${revision}.js`);
  const child = spawn(process.execPath, [fixture, 'http'], {
    env: { ...process.env, MCP_FIXTURE_HEADERS_FILE: headersFile, MCP_FIXTURE_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const port = await new Promise<number>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(
      () => reject(new Error(`Fixture HTTP server timed out: ${stderr}`)),
      10_000,
    );
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const line = output.split('\n')[0]?.trim();
      const value = Number(line);
      if (line && Number.isInteger(value) && value > 0) {
        clearTimeout(timeout);
        resolve(value);
      }
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      if (!child.killed && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`Fixture HTTP server exited (${code}): ${stderr}`));
      }
    });
  });
  return {
    port,
    close: () => stopChild(child),
  };
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => child.once('exit', () => resolve()));
}
