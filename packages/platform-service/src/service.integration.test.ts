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

    let resolveChanged: (value: unknown) => void = () => undefined;
    const changed = new Promise<unknown>((resolve) => {
      resolveChanged = resolve;
    });
    client.onNotification('project/changed', (params) => {
      if (params.kind === 'created') resolveChanged(params);
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
      expect(projectDatabase.prepare('SELECT id FROM schema_migrations').all()).toHaveLength(1);
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
    expect(await changed).toMatchObject({
      kind: 'created',
      project: { projectId: project.projectId },
    });

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
});

function makeTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}
