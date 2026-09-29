import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runEngineProcess } from './process-runner';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('engine process runner', () => {
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
