import { describe, expect, it } from 'vitest';
import { JsonRpcChannel } from './jsonrpc-channel';
import type { JsonRpcMessage, JsonRpcTransport } from './types';

class FakeTransport implements JsonRpcTransport {
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
        id: 'worker-request',
        method: 'host/log',
        params: { level: 'info', message: 'ready' },
      });
      this.onMessage?.({ jsonrpc: '2.0', id: message.id, result: 'done' });
    }
  }

  async close(): Promise<void> {}
}

describe('generic JSON-RPC channel', () => {
  it('correlates requests and dispatches peer requests over one transport', async () => {
    const transport = new FakeTransport();
    const channel = new JsonRpcChannel(transport, 100);
    await channel.start();
    channel.onRequest('host/log', (params) => ({
      accepted: (params as { message: string }).message,
    }));

    expect(await channel.request('echo', { value: 7 })).toEqual({ value: 7 });
    expect(await channel.request('trigger')).toBe('done');
    expect(transport.sent).toContainEqual({
      jsonrpc: '2.0',
      id: 'worker-request',
      result: { accepted: 'ready' },
    });
    await channel.close();
  });

  it('contains synchronous notification handler failures and keeps serving requests', async () => {
    const transport = new FakeTransport();
    const channel = new JsonRpcChannel(transport, 100);
    await channel.start();
    channel.onNotification('worker/log', () => {
      throw new Error('Bad subscriber');
    });
    expect(() =>
      transport.onMessage?.({ jsonrpc: '2.0', method: 'worker/log', params: {} }),
    ).not.toThrow();
    expect(await channel.request('echo', { afterFailure: true })).toEqual({ afterFailure: true });
    await channel.close();
  });

  it('times out pending requests and rejects requests after close', async () => {
    const channel = new JsonRpcChannel(new FakeTransport(), 5);
    await channel.start();
    await expect(channel.request('never')).rejects.toThrow('timed out');
    await channel.close();
    await expect(channel.request('after-close')).rejects.toThrow('closed');
  });
});
