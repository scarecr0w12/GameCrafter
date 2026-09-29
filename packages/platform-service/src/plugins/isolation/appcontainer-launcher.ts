import { RpcError, RpcErrorCode, type IsolationReport } from '@gamecrafter/contracts';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { IsolationLauncher, LaunchSpec } from './types';

export class AppContainerLauncher implements IsolationLauncher {
  async probe(): Promise<IsolationReport> {
    return {
      platform: 'win32',
      backend: 'appcontainer',
      available: false,
      checks: [{ name: 'appcontainer', ok: false, detail: 'not implemented in this repository' }],
    };
  }

  launch(spec: LaunchSpec): ChildProcessWithoutNullStreams {
    void spec;
    throw new RpcError(
      'Windows AppContainer isolation is not implemented in this repository',
      RpcErrorCode.PluginIsolationUnavailable,
    );
  }
}
