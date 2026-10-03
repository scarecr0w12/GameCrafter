const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function main() {
  const directory = path.resolve('.turbo/documentation-electron', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile'),
  });
  const service = await PlatformService.start({
    paths,
    platformVersion: require('../packages/platform-service/package.json').version,
  });
  const port = await freePort(),
    cdpPort = await freePort();
  const env = {
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: paths.profileDir,
    THEIA_CONFIG_DIR: path.join(directory, 'theia'),
    GAMECRAFTER_CDP_URL: `http://127.0.0.1:${cdpPort}`,
    GAMECRAFTER_SMOKE_ARTIFACT_DIR: path.join(directory, 'smoke'),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const log = fs.openSync(path.join(directory, 'electron.log'), 'a');
  const electron = spawn(
    require('electron'),
    [
      path.resolve('apps/control-room'),
      '--port',
      String(port),
      '--hostname',
      '127.0.0.1',
      `--remote-debugging-port=${cdpPort}`,
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
    { env, windowsHide: true, stdio: ['ignore', log, log] },
  );
  let launchError;
  electron.on('error', (error) => {
    launchError = error;
  });
  try {
    for (let attempt = 0; attempt < 90; attempt++) {
      if (launchError) throw launchError;
      if (electron.exitCode !== null)
        throw new Error('Owned Electron exited: ' + electron.exitCode);
      try {
        if ((await fetch(`${env.GAMECRAFTER_CDP_URL}/json/version`)).ok) break;
      } catch {
        /* Wait for owned CDP endpoint. */
      }
      if (attempt === 89) throw new Error('Owned Electron CDP endpoint did not start');
      await delay(500);
    }
    const smoke = spawn(process.execPath, ['scripts/live-ui-smoke.cjs', '--electron'], {
      env,
      windowsHide: true,
      stdio: 'inherit',
    });
    await new Promise((resolve, reject) => {
      smoke.once('error', reject);
      smoke.once('exit', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Electron smoke exited ${code}; inspect ${directory}`)),
      );
    });
    console.log(`Electron documentation smoke passed: ${directory}`);
  } finally {
    if (process.platform === 'win32' && electron.pid) {
      const kill = spawn('taskkill', ['/PID', String(electron.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      await new Promise((resolve) => kill.once('exit', resolve));
    } else electron.kill();
    await service.stop();
    fs.closeSync(log);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
