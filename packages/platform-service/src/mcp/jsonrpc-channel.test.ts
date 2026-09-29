import { describe, expect, it } from 'vitest';
import { JsonRpcChannel } from '../ipc/jsonrpc-channel';
import type { JsonRpcMessage, McpTransport } from './types';

class FakeTransport implements McpTransport {
  readonly kind = 'fake';
  readonly legacy = false;
  readonly sent: JsonRpcMessage[] = [];
  onMessage?: (message: JsonRpcMessage) => void;
  onError?: (error: Error) => void;

  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onError = onError;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    this.sent.push(message);
    if (message.method === 'echo') {
      this.onMessage?.({ jsonrpc: '2.0', id: message.id, result: message.params });
    } else if (message.method === 'trigger') {
      this.onMessage?.({
        jsonrpc: '2.0',
        id: 'server-question',
        method: 'server/question',
        params: { prompt: 'Continue?' },
      });
      this.onMessage?.({ jsonrpc: '2.0', id: message.id, result: 'complete' });
    }
  }

  async close(): Promise<void> {}
}

describe('JSON-RPC MCP channel', () => {
  it('correlates client requests and dispatches server requests over the same transport', async () => {
    const transport = new FakeTransport();
    const channel = new JsonRpcChannel(transport, 100);
    await channel.start();
    channel.onRequest('server/question', (params) => ({
      accepted: (params as { prompt: string }).prompt,
    }));

    expect(await channel.request('echo', { value: 4 })).toEqual({ value: 4 });
    expect(await channel.request('trigger')).toBe('complete');
    expect(transport.sent).toContainEqual({
      jsonrpc: '2.0',
      id: 'server-question',
      result: { accepted: 'Continue?' },
    });
    await channel.close();
  });

  it('times out unresolved requests and rejects them when the connection closes', async () => {
    const transport = new FakeTransport();
    const channel = new JsonRpcChannel(transport, 5);
    await channel.start();
    await expect(channel.request('never-responds')).rejects.toThrow('timed out');
    await channel.close();
    await expect(channel.request('after-close')).rejects.toThrow('closed');
  });
});
