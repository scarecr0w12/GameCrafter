import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { IsolationReport } from '@gamecrafter/contracts';
import type { IsolationLauncher, LaunchSpec } from './types';

export class UnisolatedLauncher implements IsolationLauncher {
  async probe(): Promise<IsolationReport> {
    return {
      platform: process.platform === 'win32' ? 'win32' : 'linux',
      backend: 'none',
      available: true,
      checks: [{ name: 'isolation', ok: false, detail: 'No OS isolation is enforced.' }],
    };
  }

  launch(spec: LaunchSpec): ChildProcessWithoutNullStreams {
    return spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;
  }
}
