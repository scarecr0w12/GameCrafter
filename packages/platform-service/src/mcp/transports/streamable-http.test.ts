import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonRpcChannel } from '../jsonrpc-channel';
import { StreamableHttpTransport } from './streamable-http';

const servers: ReturnType<typeof createServer>[] = [];

async function startServer(
  onRequest: (
    request: IncomingMessage,
    response: ServerResponse,
    body: Record<string, unknown>,
  ) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.on('end', () =>
      onRequest(request, response, JSON.parse(body) as Record<string, unknown>),
    );
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('HTTP fixture did not bind a TCP port');
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('MCP Streamable HTTP transport', () => {
  it('sends legacy session and negotiated revision headers for 2025 servers', async () => {
    const observed: Array<Record<string, string | string[] | undefined>> = [];
    const fixture = await startServer((request, response, message) => {
      observed.push(request.headers);
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': 'session-next',
      });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [] } }));
    });
    const transport = new StreamableHttpTransport({
      url: fixture.url,
      connectionName: 'dungeon-tools',
      headers: { 'X-Fixture': 'visible' },
      requestTimeoutMs: 2_000,
    });
    const channel = new JsonRpcChannel(transport, 2_000);
    await channel.start();
    transport.configure('2025-06-18', 'session-before', 'dungeon-tools');
    await channel.request('tools/list', {});
    expect(observed[0]).toMatchObject({
      'mcp-session-id': 'session-before',
      'mcp-protocol-version': '2025-06-18',
      'x-fixture': 'visible',
    });
    expect(observed[0]).not.toHaveProperty('mcp-method');
    await channel.close();
    await fixture.close();
  });

  it('captures a legacy session id and sends it on subsequent requests', async () => {
    const observed: Array<Record<string, string | string[] | undefined>> = [];
    const fixture = await startServer((request, response, message) => {
      observed.push(request.headers);
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': 'session-issued',
      });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {} }));
    });
    const transport = new StreamableHttpTransport({
      url: fixture.url,
      connectionName: 'legacy-tools',
      headers: {},
      requestTimeoutMs: 2_000,
    });
    const channel = new JsonRpcChannel(transport, 2_000);
    await channel.start();
    await channel.request('initialize', { protocolVersion: '2025-06-18' });
    transport.configure('2025-06-18', 'session-issued', 'legacy-tools');
    await channel.request('tools/list', {});
    expect(observed[0]).not.toHaveProperty('mcp-session-id');
    expect(observed[0]).not.toHaveProperty('mcp-protocol-version');
    expect(observed[1]).toMatchObject({
      'mcp-session-id': 'session-issued',
      'mcp-protocol-version': '2025-06-18',
    });
    await channel.close();
    await fixture.close();
  });

  it('surfaces HTTP JSON-RPC errors with status without retaining failed-probe session IDs', async () => {
    const observed: Array<Record<string, string | string[] | undefined>> = [];
    let requests = 0;
    const fixture = await startServer((request, response, message) => {
      observed.push(request.headers);
      requests += 1;
      if (requests === 1) {
        response.writeHead(400, {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': 'failed-probe-session',
        });
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32000, message: 'Bad Request: Server not initialized' },
          }),
        );
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {} }));
    });
    const transport = new StreamableHttpTransport({
      url: fixture.url,
      connectionName: 'legacy-tools',
      headers: {},
      requestTimeoutMs: 2_000,
    });
    const channel = new JsonRpcChannel(transport, 2_000);
    try {
      await channel.start();
      transport.configure('2025-06-18', null, 'legacy-tools');
      await expect(channel.request('server/discover')).rejects.toMatchObject({
        name: 'McpProtocolError',
        code: -32000,
        httpStatus: 400,
        message: 'Bad Request: Server not initialized',
      });
      await channel.request('initialize', {});
      expect(observed[1]).not.toHaveProperty('mcp-session-id');
    } finally {
      await channel.close();
      await fixture.close();
    }
  });

  it('retains HTTP status on non-JSON transport failures', async () => {
    const fixture = await startServer((_request, response) => {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    });
    const channel = new JsonRpcChannel(
      new StreamableHttpTransport({
        url: fixture.url,
        connectionName: 'missing-tools',
        headers: {},
        requestTimeoutMs: 2_000,
      }),
      2_000,
    );
    try {
      await channel.start();
      await expect(channel.request('server/discover')).rejects.toMatchObject({
        name: 'McpTransportError',
        httpStatus: 404,
      });
    } finally {
      await channel.close();
      await fixture.close();
    }
  });

  it('parses SSE responses containing JSON-RPC messages', async () => {
    const fixture = await startServer((_request, response, message) => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.end(
        `data: ${JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [] } })}\n\n`,
      );
    });
    const channel = new JsonRpcChannel(
      new StreamableHttpTransport({
        url: fixture.url,
        connectionName: 'event-tools',
        headers: {},
        requestTimeoutMs: 2_000,
      }),
      2_000,
    );
    try {
      await channel.start();
      expect(await channel.request('tools/list')).toEqual({ tools: [] });
    } finally {
      await channel.close();
      await fixture.close();
    }
  });

  it('sends method/name headers without a session for 2026-07-28', async () => {
    const observed: Array<Record<string, string | string[] | undefined>> = [];
    const fixture = await startServer((request, response, message) => {
      observed.push(request.headers);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [] } }));
    });
    const transport = new StreamableHttpTransport({
      url: fixture.url,
      connectionName: 'dungeon-tools',
      headers: {},
      requestTimeoutMs: 2_000,
    });
    const channel = new JsonRpcChannel(transport, 2_000);
    await channel.start();
    transport.configure('2026-07-28', null, 'dungeon-tools');
    await channel.request('tools/list', {
      _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
    });
    expect(observed[0]).toMatchObject({
      'mcp-method': 'tools/list',
      'mcp-name': 'dungeon-tools',
    });
    expect(observed[0]).not.toHaveProperty('mcp-session-id');
    expect(observed[0]).not.toHaveProperty('mcp-protocol-version');
    await channel.close();
    await fixture.close();
  });
});
