import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';

export interface ServicePaths {
  profileDir: string;
  runtimeDir: string | undefined;
  socketPath: string;
  tokenPath: string;
  lockPath: string;
  profileDbPath: string;
  logDir: string;
}

export function resolvePaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ServicePaths {
  const profileOverride = env.GAMECRAFTER_PROFILE_DIR;
  const windows = platform === 'win32';
  const profileDir = windows
    ? path.win32.resolve(
        profileOverride ??
          path.win32.join(
            env.APPDATA ?? path.win32.join(homedir(), 'AppData', 'Roaming'),
            'GameCrafter',
          ),
      )
    : path.resolve(
        profileOverride ??
          path.join(env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'gamecrafter'),
      );
  const runtimeDir = windows
    ? undefined
    : profileOverride
      ? path.join(profileDir, 'run')
      : env.XDG_RUNTIME_DIR
        ? path.join(env.XDG_RUNTIME_DIR, 'gamecrafter')
        : path.join(profileDir, 'run');
  const socketPath = windows
    ? `\\\\.\\pipe\\gamecrafter-${createHash('sha256').update(profileDir).digest('hex').slice(0, 16)}`
    : path.join(runtimeDir!, 'service.sock');
  const paths = windows ? path.win32 : path;

  return {
    profileDir,
    runtimeDir,
    socketPath,
    tokenPath: paths.join(profileDir, 'service.token'),
    lockPath: paths.join(profileDir, 'service.lock'),
    profileDbPath: paths.join(profileDir, 'profile.sqlite'),
    logDir: paths.join(profileDir, 'logs'),
  };
}
