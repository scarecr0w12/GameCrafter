import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPlatformServiceEnvironment, resolvePlatformServiceCli } from './service-connection';

describe('platform service packaging paths', () => {
  it('resolves the service bin and worker entry from the installed package', () => {
    const cliPath = resolvePlatformServiceCli();
    const packageLib = path.dirname(cliPath);

    expect(path.basename(cliPath)).toBe('cli.js');
    expect(existsSync(cliPath)).toBe(true);
    expect(existsSync(path.join(packageLib, 'workers', 'worker-main.js'))).toBe(true);
  });

  it('launches the service CLI in Node mode without creating another Electron window', () => {
    const environment = createPlatformServiceEnvironment({ GAMECRAFTER_PROFILE_DIR: 'profile' });

    expect(environment).toEqual({
      GAMECRAFTER_PROFILE_DIR: 'profile',
      ELECTRON_RUN_AS_NODE: '1',
    });
  });
});
