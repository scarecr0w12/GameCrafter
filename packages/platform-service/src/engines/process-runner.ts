import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { EngineRunArtifact } from '@gamecrafter/contracts';
import type { EngineProcessResult } from './types';

const maxCapturedOutput = 1024 * 1024;

export interface EngineProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  projectPath: string;
  runDirectory: string;
  artifactRoot?: string;
  extraEnv?: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal: AbortSignal;
  redactCommand(command: string, args: string[]): string[];
}

export async function runEngineProcess(
  options: EngineProcessOptions,
): Promise<EngineProcessResult> {
  mkdirSync(options.runDirectory, { recursive: true });
  const stdoutPath = path.join(options.runDirectory, 'stdout.log');
  const stderrPath = path.join(options.runDirectory, 'stderr.log');
  if (!existsSync(stdoutPath)) writeFileSync(stdoutPath, '');
  if (!existsSync(stderrPath)) writeFileSync(stderrPath, '');
  const started = Date.now();
  const commandForDisplay = options.redactCommand(options.command, options.args);
  const artifactRoot =
    options.artifactRoot ?? `.gamecrafter/engine-runs/${path.basename(options.runDirectory)}`;
  const artifacts: EngineRunArtifact[] = [
    { kind: 'log', path: artifactPath(options.runDirectory, stdoutPath, artifactRoot) },
    { kind: 'log', path: artifactPath(options.runDirectory, stderrPath, artifactRoot) },
  ];
  if (options.signal.aborted) {
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      cancelled: true,
      command: commandForDisplay,
      artifacts,
    };
  }

  return new Promise<EngineProcessResult>((resolve, reject) => {
    const childEnv: NodeJS.ProcessEnv = {
      ...options.extraEnv,
      PATH: process.env.PATH ?? '',
      HOME: options.projectPath,
      TMPDIR: options.runDirectory,
      LANG: 'C.UTF-8',
    };
    if (process.platform === 'win32' && process.env.SystemRoot) {
      childEnv.SystemRoot = process.env.SystemRoot;
    }
    let child;
    try {
      child = spawn(options.command, options.args, {
        cwd: options.cwd,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let cancelled = false;
    let spawnError: Error | null = null;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const finishKill = (): void => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 1000);
      forceKillTimer.unref();
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      finishKill();
    }, options.timeoutMs);
    timeout.unref();
    const onAbort = (): void => {
      cancelled = true;
      finishKill();
    };
    options.signal.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      appendFileSync(stdoutPath, buffer);
      if (Buffer.byteLength(stdout) < maxCapturedOutput) {
        stdout += buffer
          .subarray(0, maxCapturedOutput - Buffer.byteLength(stdout))
          .toString('utf8');
      }
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      appendFileSync(stderrPath, buffer);
      if (Buffer.byteLength(stderr) < maxCapturedOutput) {
        stderr += buffer
          .subarray(0, maxCapturedOutput - Buffer.byteLength(stderr))
          .toString('utf8');
      }
    });
    child.once('error', (error) => {
      spawnError = error;
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      options.signal.removeEventListener('abort', onAbort);
      if (spawnError) {
        reject(spawnError);
        return;
      }
      resolve({
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut,
        cancelled,
        command: commandForDisplay,
        artifacts,
      });
    });
  });
}

function artifactPath(runDirectory: string, filePath: string, artifactRoot: string): string {
  const relative = path.relative(runDirectory, filePath).split(path.sep).join('/');
  return `${artifactRoot}/${relative}`;
}
