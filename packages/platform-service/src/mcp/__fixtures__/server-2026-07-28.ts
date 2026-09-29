import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const mcp2026Tools = [
  {
    name: 'echo',
    description: 'Echo a supplied value.',
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'write_file',
    description: 'A destructive fixture tool.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    annotations: { destructiveHint: true },
  },
  {
    name: 'unannotated',
    description: 'An unannotated fixture tool.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'execute_code',
    description: 'Code execution remains destructive despite its read-only hint.',
    inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'needs_input',
    description: 'Returns an MRTR input request once before completing.',
    inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_env',
    description: 'Returns a fixture environment variable for credential tests.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'project_identity',
    description: 'Reports the fixture live-editor project identity.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'screenshot',
    description: 'Returns a fixture screenshot image.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'edit_scene',
    description: 'Edits a fixture scene through the live editor.',
    inputSchema: {
      type: 'object',
      properties: { scene: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'console',
    description: 'Runs a destructive fixture editor console command.',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

export interface Mcp2026HttpFixture {
  url: string;
  requests: Array<{ method: string; headers: IncomingMessage['headers'] }>;
  close(): Promise<void>;
}

export async function startMcp2026HttpFixture(
  port = 0,
  projectId = '',
): Promise<Mcp2026HttpFixture> {
  const requests: Mcp2026HttpFixture['requests'] = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method ?? '', headers: { ...request.headers } });
    if (request.method !== 'POST') {
      response.writeHead(405).end();
      return;
    }
    void readJsonBody(request)
      .then((message) => respondHttp(message, response, projectId))
      .catch((error: unknown) => {
        response.writeHead(400, { 'content-type': 'text/plain' });
        response.end(error instanceof Error ? error.message : String(error));
      });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('MCP 2026 fixture failed to bind');
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function runMcp2026Stdio(): Promise<void> {
  if (process.env.MCP_FIXTURE_SECRET) {
    process.stderr.write(`fixture secret: ${process.env.MCP_FIXTURE_SECRET}\n`);
  }
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line) as JsonRpcMessage;
        const response = handleMessage(message);
        if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
      } catch (error) {
        process.stderr.write(
          `fixture parse error: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
    }
  });
}

if (require.main === module) {
  const mode = process.argv[2] ?? 'stdio';
  if (mode === 'stdio') void runMcp2026Stdio();
  else if (mode === 'http') {
    const port = Number(process.env.MCP_FIXTURE_PORT ?? 0);
    void startMcp2026HttpFixture(port).then(({ url }) => {
      process.stdout.write(`${new URL(url).port}\n`);
    });
  } else {
    throw new Error(`Unknown MCP 2026 fixture mode: ${mode}`);
  }
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
}

function handleMessage(
  message: JsonRpcMessage,
  projectId = process.env.GAMECRAFTER_TEST_PROJECT_ID ?? '',
): Record<string, unknown> | undefined {
  if (!message.method || message.id === undefined) return undefined;
  const params = isRecord(message.params) ? message.params : {};
  const metadata = isRecord(params._meta) ? params._meta : {};
  if (message.method === 'server/discover') {
    if (metadata['io.modelcontextprotocol/protocolVersion'] !== '2026-07-28') {
      return rpcError(message.id, -32022, 'Unsupported protocol version');
    }
    return rpcResult(message.id, {
      resultType: 'complete',
      protocolVersions: ['2026-07-28'],
      serverInfo: { name: 'handwritten-2026-fixture', version: '1.0.0' },
      capabilities: { tools: { listChanged: true }, subscriptions: { listen: true } },
    });
  }
  if (message.method === 'initialize')
    return rpcError(message.id, -32601, 'initialize is not supported');
  if (metadata['io.modelcontextprotocol/protocolVersion'] !== '2026-07-28') {
    return rpcError(message.id, -32022, 'Unsupported protocol version');
  }
  if (message.method === 'tools/list') {
    return rpcResult(message.id, {
      resultType: 'complete',
      tools: mcp2026Tools,
      ttlMs: 60_000,
      cacheScope: 'connection',
    });
  }
  if (message.method === 'subscriptions/listen') {
    return rpcResult(message.id, {
      resultType: 'complete',
      subscriptions: params.subscriptions ?? [],
    });
  }
  if (message.method === 'tools/call') {
    const name = params.name;
    const input = isRecord(params.arguments) ? params.arguments : {};
    if (name === 'needs_input') {
      if (!('inputResponses' in params)) {
        return rpcResult(message.id, {
          resultType: 'input_required',
          inputRequests: [{ id: 'confirmation', prompt: 'Continue?', options: ['yes', 'no'] }],
          requestState: { opaque: 'fixture-state-42' },
        });
      }
      return rpcResult(message.id, {
        resultType: 'complete',
        content: [{ type: 'text', text: String(input.value ?? '') }],
        inputResponses: params.inputResponses,
        requestState: params.requestState,
      });
    }
    if (name === 'echo') {
      return rpcResult(message.id, {
        resultType: 'complete',
        content: [{ type: 'text', text: String(input.value ?? '') }],
      });
    }
    if (name === 'read_env') {
      return rpcResult(message.id, {
        resultType: 'complete',
        content: [{ type: 'text', text: process.env.MCP_FIXTURE_SECRET ?? '' }],
      });
    }
    if (name === 'project_identity') {
      return rpcResult(message.id, {
        resultType: 'complete',
        content: [{ type: 'text', text: JSON.stringify({ projectId }) }],
      });
    }
    if (name === 'screenshot') {
      return rpcResult(message.id, {
        resultType: 'complete',
        content: [
          {
            type: 'image',
            mimeType: 'image/png',
            data: Buffer.from('fixture-image').toString('base64'),
          },
        ],
      });
    }
    if (name === 'edit_scene' || name === 'console') {
      return rpcResult(message.id, {
        resultType: 'complete',
        content: [{ type: 'text', text: JSON.stringify(input) }],
      });
    }
    return rpcResult(message.id, {
      resultType: 'complete',
      content: [{ type: 'text', text: String(name ?? 'unknown') }],
    });
  }
  return rpcError(message.id, -32601, `Method not found: ${message.method}`);
}

async function respondHttp(
  message: JsonRpcMessage,
  response: ServerResponse,
  projectId: string,
): Promise<void> {
  if (message.method === 'subscriptions/listen' && message.id !== undefined) {
    response.writeHead(200, { 'content-type': 'text/event-stream', connection: 'keep-alive' });
    response.write(
      `event: message\ndata: ${JSON.stringify(handleMessage(message, projectId))}\n\n`,
    );
    const timer = setTimeout(() => response.end(), 50);
    timer.unref?.();
    return;
  }
  const result = handleMessage(message, projectId);
  if (message.id === undefined) {
    response.writeHead(202).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(result));
}

function rpcResult(id: string | number, result: unknown): Record<string, unknown> {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: string | number, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function readJsonBody(request: IncomingMessage): Promise<JsonRpcMessage> {
  let body = '';
  request.setEncoding('utf8');
  for await (const chunk of request) body += chunk;
  return JSON.parse(body) as JsonRpcMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
