import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveClientPaths } from '@gamecrafter/service-client';
import { resolvePaths } from './paths';

describe('service paths', () => {
  it('uses XDG config and runtime directories on Linux', () => {
    const paths = resolvePaths(
      { XDG_CONFIG_HOME: '/home/example/.config', XDG_RUNTIME_DIR: '/run/user/1000' },
      'linux',
    );

    expect(paths.profileDir).toBe('/home/example/.config/gamecrafter');
    expect(paths.runtimeDir).toBe('/run/user/1000/gamecrafter');
    expect(paths.socketPath).toBe('/run/user/1000/gamecrafter/service.sock');
  });

  it('uses the profile run directory when Linux XDG variables are missing', () => {
    const paths = resolvePaths({}, 'linux');

    expect(paths.profileDir).toBe(path.posix.resolve(homedir(), '.config', 'gamecrafter'));
    expect(paths.runtimeDir).toBe(path.posix.join(paths.profileDir, 'run'));
    expect(paths.socketPath).toBe(path.posix.join(paths.profileDir, 'run', 'service.sock'));
  });

  it('uses a deterministic Windows named pipe', () => {
    const profileDir = path.win32.resolve('C:\\Users\\example\\AppData\\Roaming\\GameCrafter');
    const hash = createHash('sha256').update(profileDir).digest('hex').slice(0, 16);
    const paths = resolvePaths({ APPDATA: 'C:\\Users\\example\\AppData\\Roaming' }, 'win32');

    expect(paths.profileDir).toBe(profileDir);
    expect(paths.runtimeDir).toBeUndefined();
    expect(paths.socketPath).toBe(`\\\\.\\pipe\\gamecrafter-${hash}`);
  });

  it('uses the explicit profile override for the profile and runtime directories', () => {
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: '/tmp/gamecrafter-profile' }, 'linux');

    expect(paths.profileDir).toBe('/tmp/gamecrafter-profile');
    expect(paths.runtimeDir).toBe('/tmp/gamecrafter-profile/run');
    expect(paths.socketPath).toBe('/tmp/gamecrafter-profile/run/service.sock');
  });

  it.each([
    { XDG_CONFIG_HOME: '/home/example/.config', XDG_RUNTIME_DIR: '/run/user/1000' },
    {},
    { GAMECRAFTER_PROFILE_DIR: '/tmp/gamecrafter-override' },
  ])(
    'keeps client discovery paths aligned with service paths for $GAMECRAFTER_PROFILE_DIR',
    (env) => {
      const servicePaths = resolvePaths(env, 'linux');
      const clientPaths = resolveClientPaths(env, 'linux');

      expect(clientPaths).toEqual({
        socketPath: servicePaths.socketPath,
        tokenPath: servicePaths.tokenPath,
      });
    },
  );
});
