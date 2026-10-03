import net from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { resolvePaths } from '../paths';
import { IpcServer, type RpcHandlers } from './server';

it('does not retain a partial-frame notification timer after a peer closes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gc-ipc-partial-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: directory });
  const server = new IpcServer({ paths, token: 'fixture-token', handlers: {} as RpcHandlers });
  let peer: net.Socket | undefined;
  try {
    await server.listen();
    peer = net.connect(paths.socketPath);
    await new Promise<void>((resolve, reject) => {
      peer!.once('connect', resolve);
      peer!.once('error', reject);
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    peer.write('Content-Length: 100\r\n\r\n{');
    await delay(100);
    peer.destroy();
    await server.close();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
    peer?.destroy();
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
