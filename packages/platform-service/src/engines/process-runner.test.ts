import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runEngineProcess } from './process-runner';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('engine process runner', () => {
  it('keeps credential variables out of engine processes and supplies Windows prerequisites', async () => {
    const projectPath = mkdtempSync(path.join(tmpdir(), 'gc-engine-env-'));
    temporaryDirectories.push(projectPath);
    const runDirectory = path.join(projectPath, '.gamecrafter', 'engine-runs', 'env-test');
    vi.stubEnv('GAMECRAFTER_TEST_PROVIDER_SECRET', 'must-not-forward');
    const result = await runEngineProcess({
      command: process.execPath,
      args: [
        '-e',
        'console.log(JSON.stringify({secret:process.env.GAMECRAFTER_TEST_PROVIDER_SECRET, profile:process.env.USERPROFILE, appdata:process.env.APPDATA, temp:process.env.TEMP, home:process.env.HOME}))',
      ],
      cwd: projectPath,
      projectPath,
      runDirectory,
      timeoutMs: 10000,
      signal: new AbortController().signal,
      redactCommand: (command, args) => [command, ...args],
    });
    expect(result.exitCode).toBe(0);
    const env = JSON.parse(result.stdout) as Record<string, string>;
    expect(env.secret).toBeUndefined();
    expect(env.home).toBe(projectPath);
    if (process.platform === 'win32') {
      expect(env.profile).toBe(process.env.USERPROFILE);
      expect(env.appdata).toBe(process.env.APPDATA);
      expect(env.temp).toBe(runDirectory);
    }
  });

  it('terminates a running engine process when its caller is cancelled', async () => {
    const projectPath = mkdtempSync(path.join(tmpdir(), 'gc-engine-cancel-'));
    temporaryDirectories.push(projectPath);
    const runDirectory = path.join(projectPath, '.gamecrafter', 'engine-runs', 'cancel-test');
    const controller = new AbortController();
    const pending = runEngineProcess({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: projectPath,
      projectPath,
      runDirectory,
      timeoutMs: 10_000,
      signal: controller.signal,
      redactCommand: (command, args) => [command, ...args],
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort('test_cancel');
    const result = await pending;
    expect(result.cancelled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeLessThan(2_000);
    expect(result.artifacts.map((artifact) => artifact.path)).toContain(
      '.gamecrafter/engine-runs/cancel-test/stdout.log',
    );
  });
});
