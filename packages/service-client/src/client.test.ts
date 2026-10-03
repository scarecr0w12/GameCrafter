import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { createMessageConnection, ResponseError } from 'vscode-jsonrpc/node';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { connect } from './index';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('service client', () => {
  it('does not leave a partial-frame timer alive after closing the client', async () => {
    const socketPath =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\gamecrafter-partial-${randomUUID()}`
        : path.join(tmpdir(), `gc-partial-${randomUUID()}.sock`);
    let peer: net.Socket | undefined;
    let serverConnection: ReturnType<typeof createMessageConnection> | undefined;
    const server = net.createServer((socket) => {
      peer = socket;
      serverConnection = createMessageConnection(
        new StreamMessageReader(socket),
        new StreamMessageWriter(socket),
      );
      serverConnection.onRequest('session/hello', () => ({
        ok: true,
        serviceVersion: '0.1.0',
        protocolVersion: 1,
        sessionId: '019535d4-2c00-7000-8000-000000000001',
      }));
      serverConnection.listen();
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    const client = await connect({
      socketPath,
      token: 'fixture-token',
      clientName: 'partial-frame-test',
      clientVersion: '0.0.0',
    });
    try {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      peer!.write('Content-Length: 100\r\n\r\n{');
      await delay(100);
      client.close();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      client.close();
      serverConnection?.dispose();
      peer?.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it('maps response errors to RpcError with the server code', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-client-'));
    temporaryDirectories.push(directory);
    const socketPath =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\gamecrafter-client-${randomUUID()}`
        : path.join(directory, 'service.sock');
    const server = net.createServer((socket) => {
      const connection = createMessageConnection(
        new StreamMessageReader(socket),
        new StreamMessageWriter(socket),
      );
      connection.onRequest('session/hello', () => ({
        ok: true,
        serviceVersion: '0.1.0',
        protocolVersion: 1,
        sessionId: '019535d4-2c00-7000-8000-000000000001',
      }));
      connection.onRequest('service/info', () => {
        throw new ResponseError(-32004, 'Missing project');
      });
      connection.listen();
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    const client = await connect({
      socketPath,
      token: 'test-token',
      clientName: 'test',
      clientVersion: '0.1.0',
    });
    expect(client.sessionId).toBe('019535d4-2c00-7000-8000-000000000001');

    await expect(client.call('service/info', {})).rejects.toMatchObject({
      name: 'RpcError',
      code: -32004,
      message: 'Missing project',
    });
    client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
