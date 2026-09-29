import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { definePlugin } from './index';

describe('TypeScript plugin SDK', () => {
  it('speaks the worker protocol and brokers host calls without writing logs to stdout', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const frames = createFrameReader(output);
    let latestSettings: Record<string, unknown> = {};
    let shutdownObserved = false;
    const plugin = definePlugin(
      {
        tools: {
          'sample-hello/greet': {
            async handler(value, host, context) {
              await host.log('info', `greeting for ${String((value as { name: string }).name)}`);
              const secret = await host.getSecret('api');
              return {
                output: {
                  greeting: `Hello, ${(value as { name: string }).name}!`,
                  context,
                  secret,
                },
                evidence: [{ kind: 'fixture', ref: 'greeting' }],
              };
            },
          },
        },
        onSettingsChanged(settings) {
          latestSettings = settings;
        },
        onShutdown() {
          shutdownObserved = true;
        },
      },
      { stdin: input, stdout: output },
    );
    const running = plugin.run();

    input.write(
      frame({
        jsonrpc: '2.0',
        id: 'init',
        method: 'plugin/initialize',
        params: {
          protocolVersion: 1,
          pluginId: 'sample-hello',
          version: '1.0.0',
          settings: { greetingPrefix: 'Welcome' },
        },
      }),
    );
    expect(await frames.next()).toEqual({
      jsonrpc: '2.0',
      id: 'init',
      result: { protocolVersion: 1, tools: ['sample-hello/greet'] },
    });
    expect(latestSettings).toEqual({ greetingPrefix: 'Welcome' });
    input.write(frame({ jsonrpc: '2.0', id: 'ping', method: 'ping', params: {} }));
    expect(await frames.next()).toEqual({ jsonrpc: '2.0', id: 'ping', result: {} });

    input.write(
      frame({
        jsonrpc: '2.0',
        id: 'call-1',
        method: 'plugin/tool/call',
        params: {
          toolId: 'sample-hello/greet',
          input: { name: 'Mira' },
          context: { taskId: 'task-1', agentRole: 'designer', accessMode: 'restricted' },
        },
      }),
    );
    const hostRequest = await frames.next();
    expect(hostRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'host/log',
      params: { level: 'info', message: 'greeting for Mira' },
    });
    input.write(frame({ jsonrpc: '2.0', id: hostRequest.id, result: { logged: true } }));
    const secretRequest = await frames.next();
    expect(secretRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'host/secret/get',
      params: { name: 'api' },
    });
    input.write(frame({ jsonrpc: '2.0', id: secretRequest.id, result: 'sdk-secret' }));
    expect(await frames.next()).toMatchObject({
      jsonrpc: '2.0',
      id: 'call-1',
      result: {
        output: {
          greeting: 'Hello, Mira!',
          context: { taskId: 'task-1', agentRole: 'designer', accessMode: 'restricted' },
          secret: 'sdk-secret',
        },
        evidence: [{ kind: 'fixture', ref: 'greeting' }],
      },
    });

    input.write(
      frame({
        jsonrpc: '2.0',
        method: 'plugin/settingsChanged',
        params: { settings: { greetingPrefix: 'Welcome' } },
      }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(latestSettings).toEqual({ greetingPrefix: 'Welcome' });

    input.write(frame({ jsonrpc: '2.0', id: 'shutdown', method: 'plugin/shutdown', params: {} }));
    expect(await frames.next()).toEqual({ jsonrpc: '2.0', id: 'shutdown', result: {} });
    await running;
    expect(shutdownObserved).toBe(true);
  });
});

function createFrameReader(stream: PassThrough): { next(): Promise<Record<string, unknown>> } {
  let buffered = '';
  const queued: Array<Record<string, unknown>> = [];
  const waiters: Array<(frame: Record<string, unknown>) => void> = [];
  stream.on('data', (chunk: Buffer) => {
    buffered += chunk.toString('utf8');
    for (;;) {
      const newline = buffered.indexOf('\n');
      if (newline < 0) return;
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (!line.trim()) continue;
      const frame = JSON.parse(line) as Record<string, unknown>;
      const waiter = waiters.shift();
      if (waiter) waiter(frame);
      else queued.push(frame);
    }
  });
  return {
    next: () => {
      const frame = queued.shift();
      return frame ? Promise.resolve(frame) : new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function frame(message: Record<string, unknown>): string {
  return `${JSON.stringify(message)}\n`;
}
