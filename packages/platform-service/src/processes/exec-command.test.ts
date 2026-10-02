import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { execCommand } from './exec-command';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('cross-platform command execution', () => {
  it('preserves arguments through a launcher in a directory with spaces', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-command-'));
    roots.push(root);
    const directory = path.join(root, 'tools with spaces');
    mkdirSync(directory);
    const script = path.join(directory, 'arguments.cjs');
    writeFileSync(
      script,
      '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));',
    );
    let launcher = script;
    if (process.platform === 'win32') {
      launcher = path.join(directory, 'launcher.cmd');
      writeFileSync(launcher, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
    } else chmodSync(script, 0o755);
    const args = ['two words', 'a&b', 'a|b', 'a"b', '100%', 'wow!'];
    const result = await execCommand(launcher, args);
    expect(JSON.parse(result.stdout)).toEqual(args);
  });

  it('reports nonzero exit status and both output streams', async () => {
    await expect(
      execCommand(process.execPath, [
        '-e',
        'console.log("out"); console.error("err"); process.exit(42)',
      ]),
    ).rejects.toMatchObject({ code: 42, stdout: 'out\n', stderr: 'err\n' });
  });

  it.skipIf(process.platform === 'win32')(
    'enforces a timeout even when a program ignores SIGTERM',
    async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'gc-command-timeout-'));
      roots.push(root);
      const pidFile = path.join(root, 'pid');
      const started = Date.now();
      try {
        await expect(
          Promise.race([
            execCommand(
              process.execPath,
              [
                '-e',
                `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)`,
              ],
              { timeout: 300 },
            ),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Termination did not finish')), 1500),
            ),
          ]),
        ).rejects.toThrow('timed out');
        expect(Date.now() - started).toBeLessThan(2000);
      } finally {
        if (existsSync(pidFile)) {
          try {
            process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL');
          } catch {
            /* Already terminated. */
          }
        }
      }
    },
    2500,
  );

  it('terminates timed-out programs and rejects excessive captured output', async () => {
    await expect(
      execCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 200 }),
    ).rejects.toThrow('timed out');
    await expect(
      execCommand(process.execPath, ['-e', 'console.log("x".repeat(2048))'], { maxBuffer: 100 }),
    ).rejects.toThrow('exceeded limit');
  });
});
