import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer, type IncomingMessage } from 'node:http';
import { appendFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  CreateMessageResultSchema,
  ElicitResultSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpRevision } from '@gamecrafter/contracts';

type FixtureMode = 'stdio' | 'http';

export async function runSdkFixture(revision: McpRevision): Promise<void> {
  const mode = (process.argv[2] ?? process.env.MCP_FIXTURE_MODE ?? 'stdio') as FixtureMode;
  const server = new Server(
    { name: `sdk-fixture-${revision}`, version: '1.0.0' },
    {
      capabilities: { tools: { listChanged: true } },
    },
  );
  const tools = [
    {
      name: 'echo',
      description: 'Echo the supplied text.',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    {
      name: 'write_file',
      description: 'Fixture tool marked as destructive.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      annotations: { destructiveHint: true },
    },
    {
      name: 'unannotated',
      description: 'Fixture tool without side-effect annotations.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'execute_code',
      description: 'Fixture code-execution tool, even though it claims to be read-only.',
      inputSchema: { type: 'object', properties: { source: { type: 'string' } } },
      annotations: { readOnlyHint: true },
    },
    ...(revision === '2025-06-18' || revision === '2025-11-25'
      ? [
          {
            name: 'ask_then_echo',
            description: 'Ask the user for a value, then echo it.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true },
          },
        ]
      : []),
    ...(revision === '2025-03-26'
      ? [
          {
            name: 'sample',
            description: 'Request a sampling completion.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true },
          },
        ]
      : []),
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments ?? {};
    if (name === 'echo') {
      return { content: [{ type: 'text', text: String(args.message ?? '') }] };
    }
    if (name === 'write_file') {
      return { content: [{ type: 'text', text: `would write ${String(args.path ?? '')}` }] };
    }
    if (name === 'unannotated' || name === 'execute_code') {
      return { content: [{ type: 'text', text: name }] };
    }
    if (name === 'ask_then_echo') {
      const answer = await server.request(
        {
          method: 'elicitation/create',
          params: {
            message: 'Enter a value for the fixture tool.',
            requestedSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
            },
          },
        },
        ElicitResultSchema,
      );
      return { content: [{ type: 'text', text: JSON.stringify(answer) }] };
    }
    if (name === 'sample') {
      const answer = await server.request(
        {
          method: 'sampling/createMessage',
          params: {
            messages: [
              { role: 'user', content: { type: 'text', text: 'Reply with sampled text.' } },
            ],
            maxTokens: 64,
          },
        },
        CreateMessageResultSchema,
      );
      return { content: [{ type: 'text', text: JSON.stringify(answer) }] };
    }
    return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
  });

  const capturePath = process.env.MCP_FIXTURE_HEADERS_FILE;
  if (mode === 'stdio') {
    const inner = new StdioServerTransport();
    await server.connect(new RevisionOverrideTransport(inner, revision));
    return;
  }

  const inner = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await server.connect(new RevisionOverrideTransport(inner, revision));
  const httpServer = createHttpServer((request, response) => {
    const capture = {
      method: request.method ?? '',
      headers: { ...request.headers },
      rpcMethod: null as string | null,
      status: 0,
    };
    if (capturePath) {
      response.once('finish', () => {
        capture.status = response.statusCode;
        appendFileSync(capturePath, `${JSON.stringify(capture)}\n`);
      });
    }
    if (request.method !== 'POST') {
      void inner.handleRequest(request, response).catch((error: unknown) => {
        if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain' });
        response.end(error instanceof Error ? error.message : String(error));
      });
      return;
    }
    void readJsonBody(request)
      .then((message) => {
        capture.rpcMethod = typeof message.method === 'string' ? message.method : null;
        return inner.handleRequest(request, response, message);
      })
      .catch((error: unknown) => {
        if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain' });
        response.end(error instanceof Error ? error.message : String(error));
      });
  });
  const port = Number(process.env.MCP_FIXTURE_PORT ?? 0);
  await new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (address && typeof address !== 'string') {
    process.stdout.write(`${address.port}\n`);
  }
  const close = () => {
    void server.close().finally(() => httpServer.close());
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}

class RevisionOverrideTransport implements Transport {
  private _onclose?: () => void;
  private _onerror?: (error: Error) => void;
  private _onmessage?: Transport['onmessage'];

  constructor(
    private readonly inner: Transport,
    private readonly revision: McpRevision,
  ) {}

  get onclose(): (() => void) | undefined {
    return this._onclose;
  }

  set onclose(handler: (() => void) | undefined) {
    this._onclose = handler;
    this.inner.onclose = handler;
  }

  get onerror(): ((error: Error) => void) | undefined {
    return this._onerror;
  }

  set onerror(handler: ((error: Error) => void) | undefined) {
    this._onerror = handler;
    this.inner.onerror = handler;
  }

  get onmessage(): Transport['onmessage'] {
    return this._onmessage;
  }

  set onmessage(handler: Transport['onmessage']) {
    this._onmessage = handler;
    this.inner.onmessage = handler;
  }

  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }

  setProtocolVersion(version: string): void {
    this.inner.setProtocolVersion?.(version);
  }

  start(): Promise<void> {
    return this.inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    const messageRecord = message as unknown as Record<string, unknown>;
    const result = messageRecord.result;
    if (isRecord(result) && typeof result.protocolVersion === 'string') {
      await this.inner.send(
        {
          ...messageRecord,
          result: { ...result, protocolVersion: this.revision },
        } as unknown as JSONRPCMessage,
        options,
      );
      return;
    }
    await this.inner.send(message, options);
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = '';
  request.setEncoding('utf8');
  for await (const chunk of request) body += chunk;
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) throw new Error('Expected a JSON-RPC request object');
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
