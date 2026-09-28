import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireLock, AlreadyRunningError } from './lock';
import { resolvePaths } from './paths';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function makePaths() {
  const directory = mkdtempSync(path.join(tmpdir(), 'gc-lock-'));
  directories.push(directory);
  mkdirSync(directory, { recursive: true });
  return resolvePaths({ GAMECRAFTER_PROFILE_DIR: directory }, 'linux');
}

describe('service lock', () => {
  it('acquires and releases a lock', () => {
    const paths = makePaths();
    const handle = acquireLock(paths);

    expect(JSON.parse(readFileSync(paths.lockPath, 'utf8')).pid).toBe(process.pid);
    handle.release();
    expect(() => readFileSync(paths.lockPath, 'utf8')).toThrow();
  });

  it('rejects another lock owned by a live process', () => {
    const paths = makePaths();
    const handle = acquireLock(paths);

    expect(() => acquireLock(paths)).toThrow(AlreadyRunningError);
    handle.release();
  });

  it('replaces a lock owned by a stale process', () => {
    const paths = makePaths();
    writeFileSync(
      paths.lockPath,
      JSON.stringify({ pid: 2_147_483_647, socketPath: paths.socketPath, startedAt: 'old' }),
    );

    const handle = acquireLock(paths);
    expect(handle.lock.pid).toBe(process.pid);
    handle.release();
  });
});
