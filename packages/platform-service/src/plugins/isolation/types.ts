import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { IsolationReport } from '@gamecrafter/contracts';

export interface LaunchSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  readOnlyPaths: string[];
  readWritePaths: string[];
  network: boolean;
  pluginDir: string;
  scratchDir: string;
}

export interface IsolationLauncher {
  probe(): Promise<IsolationReport>;
  launch(spec: LaunchSpec): ChildProcessWithoutNullStreams;
}
