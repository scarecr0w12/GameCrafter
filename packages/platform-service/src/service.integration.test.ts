import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PROJECT_MANIFEST_FILENAME, projectManifest } from '@gamecrafter/contracts';
import { connect } from '@gamecrafter/service-client';
import { Database } from './db/database';
import { resolvePaths } from './paths';
import { PlatformService } from './service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;

afterEach(async () => {
  await service?.stop();
  service = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('platform service integration', () => {
  it('authenticates clients and manages a complete local Project lifecycle', async () => {
    const profileDir = makeTemporaryDirectory('gc-profile-');
    const projectsDirectory = makeTemporaryDirectory('gc-projects-');
    const emptyDirectory = makeTemporaryDirectory('gc-empty-');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir }, 'linux');
    let resolveUnauthenticatedClose: () => void = () => undefined;
    const unauthenticatedClose = new Promise<void>((resolve) => {
      resolveUnauthenticatedClose = resolve;
    });
    service = await PlatformService.start({
      paths,
      platformVersion: '0.1.0',
      onClientEvent: (event) => {
        if (event === 'closed') resolveUnauthenticatedClose();
      },
    });
    const token = readFileSync(paths.tokenPath, 'utf8').trim();

    await expect(
      connect({
        socketPath: service.socketPath,
        token: 'wrong-token',
        clientName: 'test-client',
        clientVersion: '0.1.0',
      }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32000 });
    await unauthenticatedClose;

    const client = await connect({
      socketPath: service.socketPath,
      token,
      clientName: 'test-client',
      clientVersion: '0.1.0',
    });
    const info = await client.call('service/info', {});
    expect(info.protocolVersion).toBe(1);
    expect(info.pid).toBe(process.pid);
    expect(client.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const settingsDescription = await client.call('settings/describe', {});
    expect(settingsDescription.groups).toHaveLength(10);
    expect(settingsDescription.definitions).toHaveLength(12);

    let resolveChanged: (value: unknown) => void = () => undefined;
    let resolveCloned: (value: unknown) => void = () => undefined;
    const changed = new Promise<unknown>((resolve) => {
      resolveChanged = resolve;
    });
    const clonedChanged = new Promise<unknown>((resolve) => {
      resolveCloned = resolve;
    });
    client.onNotification('project/changed', (params) => {
      if (params.kind === 'created') resolveChanged(params);
      if (params.kind === 'cloned') resolveCloned(params);
    });

    const project = await client.call('project/create', {
      name: 'Dungeon Test',
      engine: { family: 'godot' },
      genres: ['rpg'],
      parentDirectory: projectsDirectory,
    });
    const expectedFiles = [
      PROJECT_MANIFEST_FILENAME,
      '.gitignore',
      'AGENTS.md',
      'docs/README.md',
      'game/.gitkeep',
      '.gamecrafter/project.sqlite',
      '.gamecrafter/logs/.gitkeep',
      '.gamecrafter/cache/.gitkeep',
      '.agents/skills/.gitkeep',
    ];
    for (const file of expectedFiles) expect(existsSync(path.join(project.path, file))).toBe(true);
    expect(readdirSync(project.path)).toContain('.git');

    const manifest = JSON.parse(
      readFileSync(path.join(project.path, PROJECT_MANIFEST_FILENAME), 'utf8'),
    );
    expect(projectManifest.check(manifest)).toBe(true);
    expect(readFileSync(path.join(project.path, 'AGENTS.md'), 'utf8')).toContain('godot');

    const projectDatabase = Database.open(
      path.join(project.path, '.gamecrafter', 'project.sqlite'),
    );
    try {
      expect(projectDatabase.prepare('SELECT id FROM schema_migrations').all()).toHaveLength(2);
      expect(
        projectDatabase.prepare('SELECT kind FROM events WHERE kind = ?').all('project.created'),
      ).toHaveLength(1);
    } finally {
      projectDatabase.close();
    }
    expect(
      execFileSync('git', ['log', '--oneline'], { cwd: project.path, encoding: 'utf8' })
        .trim()
        .split('\n'),
    ).toHaveLength(1);

    const listed = await client.call('project/list', {});
    expect(listed.projects).toHaveLength(1);
    expect(listed.projects[0]?.lastOpenedAt).toBeNull();
    const opened = await client.call('project/open', { path: project.path });
    expect(opened.projectId).toBe(project.projectId);
    expect(opened.lastOpenedAt).not.toBeNull();
    const projectAccess = await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      value: 'restricted',
      projectId: project.projectId,
    });
    expect(projectAccess).toMatchObject({ source: 'project', value: 'restricted' });
    expect(await client.call('settings/get', { key: 'access.mode' })).toMatchObject({
      source: 'default',
      value: 'ask-always',
    });
    expect(await changed).toMatchObject({
      kind: 'created',
      project: { projectId: project.projectId },
    });

    const originalManifest = readFileSync(
      path.join(project.path, PROJECT_MANIFEST_FILENAME),
      'utf8',
    );
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.invalid/source.git'], {
      cwd: project.path,
    });
    const clone = await client.call('project/clone', {
      projectId: project.projectId,
      name: 'Dungeon Clone',
      parentDirectory: projectsDirectory,
    });
    expect(clone.projectId).not.toBe(project.projectId);
    expect(clone.engine.family).toBe(project.engine.family);
    expect(
      await client.call('settings/get', { key: 'access.mode', projectId: clone.projectId }),
    ).toMatchObject({ source: 'project', value: 'restricted' });
    expect(readFileSync(path.join(project.path, PROJECT_MANIFEST_FILENAME), 'utf8')).toBe(
      originalManifest,
    );
    expect(
      execFileSync('git', ['log', '--oneline'], { cwd: clone.path, encoding: 'utf8' })
        .trim()
        .split('\n'),
    ).toHaveLength(2);
    expect(execFileSync('git', ['remote'], { cwd: clone.path, encoding: 'utf8' }).trim()).toBe('');
    expect(readdirSync(path.join(clone.path, '.gamecrafter', 'cache'))).toEqual(['.gitkeep']);
    expect(readFileSync(path.join(clone.path, 'AGENTS.md'), 'utf8')).toContain('Dungeon Clone');

    const cloneDatabase = Database.open(path.join(clone.path, '.gamecrafter', 'project.sqlite'));
    try {
      expect(
        cloneDatabase
          .prepare('SELECT value FROM project_meta WHERE key = ?')
          .get<{ value: string }>('cloned_from')?.value,
      ).toBe(project.projectId);
    } finally {
      cloneDatabase.close();
    }
    expect(await clonedChanged).toMatchObject({
      kind: 'cloned',
      project: { projectId: clone.projectId },
    });
    expect((await client.call('project/list', {})).projects).toHaveLength(2);

    await expect(client.call('project/open', { path: emptyDirectory })).rejects.toMatchObject({
      name: 'RpcError',
      code: -32001,
    });
    await expect(
      client.call('project/get', { projectId: '019535d4-2c00-7000-8000-000000000099' }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32004 });
    await expect(
      client.call('project/create', {
        name: 'Dungeon Test',
        engine: { family: 'godot' },
        genres: ['rpg'],
        parentDirectory: projectsDirectory,
      }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32003 });

    client.close();
  }, 30000);

  it('clears session-scoped settings when a client disconnects', async () => {
    const profileDir = makeTemporaryDirectory('gc-session-profile-');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir }, 'linux');
    let resolveClientClose: () => void = () => undefined;
    const clientClosed = new Promise<void>((resolve) => {
      resolveClientClose = resolve;
    });
    service = await PlatformService.start({
      paths,
      platformVersion: '0.1.0',
      onClientEvent: (event) => {
        if (event === 'closed') resolveClientClose();
      },
    });
    const token = readFileSync(paths.tokenPath, 'utf8').trim();
    const firstClient = await connect({
      socketPath: service.socketPath,
      token,
      clientName: 'session-test-client',
      clientVersion: '0.1.0',
    });
    await firstClient.call('settings/set', {
      key: 'access.mode',
      scope: 'session',
      value: 'restricted',
      sessionId: firstClient.sessionId,
    });
    firstClient.close();
    await clientClosed;

    const nextClient = await connect({
      socketPath: service.socketPath,
      token,
      clientName: 'session-test-client',
      clientVersion: '0.1.0',
    });
    expect(nextClient.sessionId).not.toBe(firstClient.sessionId);
    await expect(
      nextClient.call('settings/get', { key: 'access.mode', sessionId: firstClient.sessionId }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32013 });
    expect(await nextClient.call('settings/get', { key: 'access.mode' })).toMatchObject({
      source: 'default',
      value: 'ask-always',
    });
    nextClient.close();
  }, 30000);
});

function makeTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}
