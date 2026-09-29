import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { CredentialStore } from '../profile/credential-store';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { ToolRegistry } from '../tools/tool-registry';
import { McpConnectionManager } from './connection-manager';

const directories: string[] = [];
const managers: McpConnectionManager[] = [];
const cleanupDatabases: Array<() => void> = [];
afterEach(async () => {
  await Promise.all(managers.splice(0).map((manager) => manager.stop()));
  for (const cleanup of cleanupDatabases.splice(0)) cleanup();
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('MCP Docker runtime', () => {
  it('uses a manager-owned stdio container and stops it only when configured', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-mcp-docker-'));
    directories.push(directory);
    installFakeDocker(directory);
    const logPath = path.join(directory, 'docker.jsonl');
    vi.stubEnv('PATH', `${directory}${path.delimiter}${process.env.PATH ?? ''}`);
    vi.stubEnv('GC_FAKE_DOCKER_LOG', logPath);
    vi.stubEnv('GC_FAKE_DOCKER_IMAGE', 'fixture/mcp');
    const manager = createManager(directory, 'docker');
    managers.push(manager);
    const fixture = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');

    const config = manager.add({
      name: 'docker-fixture',
      scope: 'platform',
      projectId: null,
      mode: 'docker',
      docker: {
        image: 'fixture/mcp',
        command: [process.execPath, fixture],
        transport: 'stdio',
        mounts: [{ source: '/tmp/source', target: '/project', readOnly: true }],
        env: {},
        network: 'none',
        pullPolicy: 'if-missing',
        stopOnDisconnect: true,
      },
      enabled: false,
    });
    const state = await manager.connect(config.connectionId);
    expect(state).toMatchObject({ status: 'connected', containerId: 'fixture-container-id' });
    await manager.disconnect(config.connectionId);

    const commands = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[]);
    const run = commands.find((args) => args[0] === 'run');
    expect(run).toBeDefined();
    expect(run).toContain('-i');
    expect(run).toContain('--rm');
    expect(run).toContain('--network');
    expect(run).toContain('none');
    expect(run).toContain('-v');
    expect(run).toContain('/tmp/source:/project:ro');
    expect(commands.some((args) => args[0] === 'stop' && args[1] === 'fixture-container-id')).toBe(
      true,
    );
  }, 60_000);

  it('does not call docker stop when stopOnDisconnect is disabled', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-mcp-docker-'));
    directories.push(directory);
    installFakeDocker(directory);
    const logPath = path.join(directory, 'docker.jsonl');
    vi.stubEnv('PATH', `${directory}${path.delimiter}${process.env.PATH ?? ''}`);
    vi.stubEnv('GC_FAKE_DOCKER_LOG', logPath);
    vi.stubEnv('GC_FAKE_DOCKER_IMAGE', 'fixture/mcp');
    const manager = createManager(directory, 'docker');
    managers.push(manager);
    const fixture = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
    const config = manager.add({
      name: 'docker-keep',
      scope: 'platform',
      projectId: null,
      mode: 'docker',
      docker: {
        image: 'fixture/mcp',
        command: [process.execPath, fixture],
        transport: 'stdio',
        mounts: [],
        env: {},
        network: 'none',
        pullPolicy: 'if-missing',
        stopOnDisconnect: false,
      },
      enabled: false,
    });
    await manager.connect(config.connectionId);
    await manager.disconnect(config.connectionId);
    const commands = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[]);
    expect(commands.some((args) => args[0] === 'stop')).toBe(false);
  }, 60_000);

  it('maps a missing Docker executable to McpDockerUnavailable', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-mcp-docker-missing-'));
    directories.push(directory);
    const manager = createManager(directory, path.join(directory, 'missing-docker'));
    managers.push(manager);
    const config = manager.add({
      name: 'docker-missing',
      scope: 'platform',
      projectId: null,
      mode: 'docker',
      docker: {
        image: 'fixture/mcp',
        command: [],
        transport: 'stdio',
        mounts: [],
        env: {},
        network: 'none',
        pullPolicy: 'if-missing',
        stopOnDisconnect: true,
      },
      enabled: false,
    });
    await expect(manager.connect(config.connectionId)).rejects.toMatchObject({ code: -32065 });
  });
});

function installFakeDocker(directory: string): string {
  const fixture = path.resolve(__dirname, './__fixtures__/fake-docker.cjs');
  const executable = path.join(directory, 'docker');
  copyFileSync(fixture, executable);
  chmodSync(executable, 0o755);
  return executable;
}

function createManager(directory: string, dockerBinary: string): McpConnectionManager {
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const profile = new ProfileStore(database);
  const projectDatabases = new ProjectDatabases(profile);
  cleanupDatabases.push(() => {
    projectDatabases.close();
    database.close();
  });
  const settingsRegistry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
  return new McpConnectionManager({
    database,
    profile,
    credentials: new CredentialStore(database, path.join(directory, 'profile')),
    settings: new SettingsService(settingsRegistry, database, projectDatabases),
    tasks: {} as never,
    completion: {} as never,
    tools: new ToolRegistry(),
    events: { stateChanged: () => undefined, inputRequired: () => undefined },
    clientInfo: { name: 'docker-test', version: '1.0.0' },
    dockerBinary,
    now: () => new Date('2026-09-28T00:00:00.000Z'),
  });
}
