import { createServer, type IncomingMessage } from 'node:http';
import { expect, it } from 'vitest';
import { JsonRpcChannel } from '../../ipc/jsonrpc-channel';
import { LegacySseTransport } from './legacy-sse';

it('uses the SSE endpoint event to POST legacy JSON-RPC messages', async () => {
  let postHeaders: IncomingMessage['headers'] | undefined;
  const server = createServer((request, response) => {
    if (request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('event: endpoint\ndata: /messages?session=fixture\n\n');
      return;
    }
    postHeaders = request.headers;
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.on('end', () => {
      const message = JSON.parse(body) as Record<string, unknown>;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { ok: true } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('SSE fixture did not bind a port');
  const baseUrl = `http://127.0.0.1:${address.port}/sse`;
  const transport = new LegacySseTransport({ url: baseUrl, headers: {}, requestTimeoutMs: 2_000 });
  const channel = new JsonRpcChannel(transport, 2_000);
  try {
    await channel.start();
    transport.configure('2025-06-18', null, 'legacy-tools');
    expect(transport.legacy).toBe(true);
    expect(await channel.request('tools/list', {})).toEqual({ ok: true });
    expect(postHeaders?.['mcp-protocol-version']).toBe('2025-06-18');
  } finally {
    await channel.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
