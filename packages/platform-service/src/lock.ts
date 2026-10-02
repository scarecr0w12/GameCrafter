import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import type { ServicePaths } from './paths';

export interface ServiceLock {
  pid: number;
  socketPath: string;
  startedAt: string;
}

export class AlreadyRunningError extends Error {
  constructor(readonly lock: ServiceLock) {
    super(`PlayWeld service is already running with pid ${lock.pid}`);
    this.name = 'AlreadyRunningError';
  }
}

export interface LockHandle {
  lock: ServiceLock;
  release(): void;
}

export function acquireLock(
  paths: Pick<ServicePaths, 'lockPath' | 'socketPath'>,
  now: () => Date = () => new Date(),
): LockHandle {
  const lock: ServiceLock = {
    pid: process.pid,
    socketPath: paths.socketPath,
    startedAt: now().toISOString(),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(paths.lockPath, `${JSON.stringify(lock, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      return {
        lock,
        release() {
          if (!existsSync(paths.lockPath)) return;
          try {
            const current = JSON.parse(readFileSync(paths.lockPath, 'utf8')) as ServiceLock;
            if (current.pid === lock.pid && current.startedAt === lock.startedAt) {
              unlinkSync(paths.lockPath);
            }
          } catch {
            return;
          }
        },
      };
    } catch (error) {
      if (!isCode(error, 'EEXIST')) throw error;
      const existing = readLock(paths.lockPath);
      if (existing && isProcessAlive(existing.pid)) throw new AlreadyRunningError(existing);
      try {
        unlinkSync(paths.lockPath);
      } catch (unlinkError) {
        if (!isCode(unlinkError, 'ENOENT')) throw unlinkError;
      }
    }
  }

  throw new Error(`Unable to acquire service lock: ${paths.lockPath}`);
}

export function readLock(lockPath: string): ServiceLock | undefined {
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as Partial<ServiceLock>;
    if (
      typeof lock.pid !== 'number' ||
      typeof lock.socketPath !== 'string' ||
      typeof lock.startedAt !== 'string'
    ) {
      return undefined;
    }
    return lock as ServiceLock;
  } catch {
    return undefined;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isCode(error, 'EPERM');
  }
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
