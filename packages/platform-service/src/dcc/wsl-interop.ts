import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type WslPathCommand = (direction: '-w' | '-u', filePath: string) => Promise<string>;

export interface WslInterop {
  isWsl(): boolean;
  toHostPath(filePath: string): Promise<string>;
  toWslPath(filePath: string): Promise<string>;
}

export interface WslInteropOptions {
  platform?: NodeJS.Platform;
  procVersion?: string;
  pathCommand?: WslPathCommand;
}

export function isWsl(platform = process.platform, procVersion = readProcVersion()): boolean {
  return platform === 'linux' && /microsoft/i.test(procVersion);
}

export function createWslInterop(options: WslInteropOptions = {}): WslInterop {
  const platform = options.platform ?? process.platform;
  const runningUnderWsl = isWsl(platform, options.procVersion);
  const command = options.pathCommand ?? defaultWslPathCommand;
  const cache = new Map<string, Promise<string>>();
  const translate = (direction: '-w' | '-u', filePath: string): Promise<string> => {
    if (!runningUnderWsl) return Promise.resolve(filePath);
    const key = `${direction}\0${filePath}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const conversion = command(direction, filePath).catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, conversion);
    return conversion;
  };
  return {
    isWsl: () => runningUnderWsl,
    toHostPath: (filePath) => translate('-w', filePath),
    toWslPath: (filePath) => translate('-u', filePath),
  };
}

export const wslInterop = createWslInterop();

export function wslInteropEnvironment(): NodeJS.ProcessEnv {
  if (!wslInterop.isWsl()) return {};
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ['WSL_INTEROP', 'WSL_DISTRO_NAME', 'WSLENV']) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return environment;
}

async function defaultWslPathCommand(direction: '-w' | '-u', filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('wslpath', [direction, filePath], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function readProcVersion(): string {
  try {
    return readFileSync('/proc/version', 'utf8');
  } catch {
    return '';
  }
}
