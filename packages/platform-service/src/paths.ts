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
  const paths = windows ? path.win32 : path.posix;
  const profileDir = windows
    ? paths.resolve(
        profileOverride ??
          paths.join(env.APPDATA ?? paths.join(homedir(), 'AppData', 'Roaming'), 'GameCrafter'),
      )
    : paths.resolve(
        profileOverride ??
          paths.join(env.XDG_CONFIG_HOME ?? paths.join(homedir(), '.config'), 'gamecrafter'),
      );
  const runtimeDir = windows
    ? undefined
    : profileOverride
      ? paths.join(profileDir, 'run')
      : env.XDG_RUNTIME_DIR
        ? paths.join(env.XDG_RUNTIME_DIR, 'gamecrafter')
        : paths.join(profileDir, 'run');
  const socketPath = windows
    ? `\\\\.\\pipe\\gamecrafter-${createHash('sha256').update(profileDir).digest('hex').slice(0, 16)}`
    : paths.join(runtimeDir!, 'service.sock');

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
