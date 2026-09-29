import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function isExecutable(filePath: string): boolean {
  try {
    const stat = statSync(filePath);
    return stat.isFile() && (process.platform === 'win32' || (stat.mode & 0o111) !== 0);
  } catch {
    return false;
  }
}

export function findOnPath(names: string[], environment: NodeJS.ProcessEnv): string[] {
  const pathValue = environment.PATH ?? environment.Path ?? '';
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  const found: string[] = [];
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      for (const suffix of suffixes) {
        const candidate = path.resolve(directory, `${name}${suffix}`);
        if (isExecutable(candidate) && !found.includes(candidate)) found.push(candidate);
      }
    }
  }
  return found;
}

export function executableCandidates(
  names: string[],
  environment: NodeJS.ProcessEnv,
  envKeys: string[],
  commonPaths: string[],
): string[] {
  const paths = [
    ...envKeys.flatMap((key) => {
      const value = environment[key];
      if (!value) return [];
      const resolved = path.resolve(value);
      if (isExecutable(resolved)) return [resolved];
      return names
        .flatMap((name) =>
          (process.platform === 'win32' ? ['', '.exe'] : ['']).map((suffix) =>
            path.join(resolved, `${name}${suffix}`),
          ),
        )
        .filter(isExecutable);
    }),
    ...findOnPath(names, environment),
    ...commonPaths.flatMap((entry) => {
      const resolved = path.resolve(entry);
      return isExecutable(resolved) ? [resolved] : [];
    }),
  ];
  return [...new Set(paths)];
}

export async function probeCommand(
  executable: string,
  args: string[],
  timeoutMs = 10_000,
): Promise<string> {
  const { stdout, stderr } = await execFileAsync(executable, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH },
  });
  return `${stdout}\n${stderr}`.trim();
}

export function readUtf8(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function prefixVersionMatch(
  detected: string | null,
  preferred: string | null,
): boolean | null {
  if (!preferred || !detected) return null;
  const match = preferred.match(/^\s*(\d+\.\d+)/);
  if (!match) return detected.startsWith(preferred);
  return detected.startsWith(match[1]);
}
