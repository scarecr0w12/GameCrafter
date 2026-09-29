import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type PluginManifest } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { PluginInstaller } from './plugin-installer';
import { PluginRegistry } from './plugin-registry';

const roots: string[] = [];
const databases: Database[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('PluginRegistry', () => {
  it('tracks Project enablement and reports module conflicts without choosing a winner', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-registry-'));
    roots.push(root);
    const database = Database.open(':memory:');
    migrate(database, profileMigrations);
    databases.push(database);
    const profile = new ProfileStore(database);
    const projectId = uuidv7();
    const projectPath = path.join(root, 'project');
    mkdirSync(projectPath);
    profile.register({
      projectId,
      name: 'Registry Project',
      description: '',
      path: projectPath,
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: '2026-09-29T00:00:00.000Z',
      createdByPlatformVersion: '0.1.0',
      lastOpenedAt: null,
      trusted: true,
    });
    const projectDatabases = new ProjectDatabases(profile);
    const settings = createSettings(database, projectDatabases);
    const installer = new PluginInstaller({
      database,
      profileDir: path.join(root, 'profile'),
      platformVersion: '0.1.0',
      settings,
    });
    const registry = new PluginRegistry({ profile, database, installer });
    const firstSource = samplePluginPath();
    const firstInspection = await installer.inspect(firstSource);
    await installer.install(firstSource, firstInspection.capabilities);
    const duplicateSource = makeDuplicatePlugin(root);
    const duplicateInspection = await installer.inspect(duplicateSource);
    await installer.install(duplicateSource, duplicateInspection.capabilities);

    expect(registry.list(projectId).map((entry) => entry.projectEnabled)).toEqual([false, false]);
    await registry.setProjectEnabled(projectId, 'sample-hello', true);
    expect(registry.isEnabledForProject('sample-hello', projectId)).toBe(true);

    const conflicted = registry.modules();
    expect(conflicted.conflicts).toContainEqual({
      id: 'hello-module',
      pluginIds: ['sample-copy', 'sample-hello'],
    });
    await registry.setPlatformEnabled('sample-copy', false);
    const disabled = registry.modules();
    expect(disabled.conflicts).not.toContainEqual(expect.objectContaining({ id: 'hello-module' }));
    expect(disabled.modules.find((entry) => entry.pluginId === 'sample-copy')?.active).toBe(false);
  });
});

function createSettings(database: Database, projectDatabases: ProjectDatabases): SettingsService {
  const builtin = createBuiltinSettings();
  const registry = new SettingsRegistry();
  registry.register('builtin', builtin.groups, builtin.definitions);
  return new SettingsService(registry, database, projectDatabases);
}

function samplePluginPath(): string {
  return path.resolve(__dirname, '../../../plugins/sample-hello');
}

function makeDuplicatePlugin(root: string): string {
  const source = samplePluginPath();
  const destination = path.join(root, 'sample-copy');
  cpSync(source, destination, {
    recursive: true,
    filter: (sourcePath) => !sourcePath.includes(`${path.sep}node_modules`),
  });
  const manifest = JSON.parse(
    readFileSync(path.join(destination, 'gamecrafter-plugin.json'), 'utf8'),
  ) as PluginManifest;
  manifest.id = 'sample-copy';
  manifest.name = 'Sample Copy';
  manifest.contributes.tools = manifest.contributes.tools.map((tool) => ({
    ...tool,
    toolId: tool.toolId.replace('sample-hello/', 'sample-copy/'),
  }));
  manifest.contributes.settings = manifest.contributes.settings.map((setting) => ({
    ...setting,
    key: setting.key.replace('plugin.sample-hello.', 'plugin.sample-copy.'),
    source: 'plugin:sample-copy',
  }));
  manifest.contributes.ui.commands = manifest.contributes.ui.commands.map((command) => ({
    ...command,
    toolId: command.toolId.replace('sample-hello/', 'sample-copy/'),
  }));
  writeFileSync(path.join(destination, 'gamecrafter-plugin.json'), JSON.stringify(manifest));
  return destination;
}
