import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { create } from 'tar';
import { afterEach, describe, expect, it } from 'vitest';
import { RpcErrorCode, type PluginManifest } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { PluginInstaller } from './plugin-installer';

const roots: string[] = [];
const databases: Database[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('PluginInstaller', () => {
  it('installs the bundled sample against the current workspace version', async () => {
    const { version } = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
    ) as { version: string };
    const { installer } = createInstaller(version);
    const inspection = await installer.inspect(samplePluginPath());
    const installed = await installer.install(samplePluginPath(), inspection.capabilities);
    expect(installed.pluginId).toBe('sample-hello');
  });
  it('inspects and installs a local plugin only after accepting its exact capabilities', async () => {
    const { installer, profileDir } = createInstaller();
    const source = samplePluginPath();
    const inspection = await installer.inspect(source);
    expect(inspection.signature.status).toBe('unsigned');
    expect(inspection.warnings).toContain('Plugin signatures are not verified by this build.');
    await expect(installer.install(source, [])).rejects.toMatchObject({
      code: RpcErrorCode.PluginCapabilitiesNotAccepted,
    });

    const installed = await installer.install(source, inspection.capabilities);
    expect(installed).toMatchObject({
      pluginId: 'sample-hello',
      version: '1.0.0',
      source: { kind: 'local-dir' },
      signature: { status: 'unsigned' },
      enabled: true,
      trust: { acceptedCapabilities: inspection.capabilities },
    });
    expect(installed.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(installed.installPath).toBe(path.join(profileDir, 'plugins', 'sample-hello', '1.0.0'));
    expect(
      readFileSync(path.join(installed.installPath, 'gamecrafter-plugin.json'), 'utf8'),
    ).toContain('sample-hello');
  });

  it('installs a .tgz archive and records its archive digest', async () => {
    const { installer } = createInstaller();
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-archive-'));
    roots.push(root);
    const archive = path.join(root, 'sample-hello.tgz');
    await create(
      {
        cwd: samplePluginPath(),
        file: archive,
        gzip: true,
        strict: true,
      },
      ['gamecrafter-plugin.json', 'dist/index.cjs', 'panels/hello.json', 'package.json'],
    );
    const inspection = await installer.inspect(archive);
    const installed = await installer.install(archive, inspection.capabilities);
    const expectedHash = await sha256File(archive);
    expect(installed.source.kind).toBe('archive');
    expect(installed.sha256).toBe(expectedHash);
  });

  it('warns when outbound host allow-lists are requested but cannot be enforced', async () => {
    const { installer } = createInstaller();
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-network-'));
    roots.push(root);
    const source = createManifestFixture(
      root,
      (manifest) => {
        manifest.capabilities = [{ capability: 'network.outbound', hosts: ['api.example.test'] }];
      },
      'network-fixture',
    );
    const inspection = await installer.inspect(source);
    expect(inspection.warnings).toContain(
      'Outbound host allow-lists cannot be enforced by the current isolation launcher.',
    );
  });

  it('rejects plugin-contributed roles with elevated privileges', async () => {
    const { installer } = createInstaller();
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-role-invalid-'));
    roots.push(root);
    const source = createManifestFixture(root, (manifest) => {
      manifest.contributes.roles = ['roles/full-access'];
    });
    mkdirSync(path.join(source, 'roles', 'full-access'), { recursive: true });
    writeFileSync(
      path.join(source, 'roles', 'full-access', 'ROLE.md'),
      '---\\nname: full-access\\ndescription: Full access role\\nwork-types: code\\nmax-access: full\\n---\\nPlugin prompt.\\n',
    );
    await expect(installer.inspect(source)).rejects.toMatchObject({
      code: RpcErrorCode.PluginManifestInvalid,
    });
  });

  it('rejects missing dependencies and incompatible platform ranges before installation', async () => {
    const { installer } = createInstaller();
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-invalid-'));
    roots.push(root);
    const source = createManifestFixture(root, (manifest) => {
      manifest.dependencies.plugins['missing-plugin'] = '^1.0.0';
    });
    await expect(installer.inspect(source)).rejects.toMatchObject({
      code: RpcErrorCode.PluginDependencyMissing,
    });
    const incompatible = createManifestFixture(
      root,
      (manifest) => {
        manifest.compatibility.platform = '^99.0.0';
      },
      'incompatible',
    );
    await expect(installer.inspect(incompatible)).rejects.toMatchObject({
      code: RpcErrorCode.PluginIncompatible,
    });
  });

  it('rejects tool schemas with external references during inspection', async () => {
    const { installer } = createInstaller();
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-schema-invalid-'));
    roots.push(root);
    const source = createManifestFixture(root, (manifest) => {
      manifest.contributes.tools[0]!.inputSchema = { $ref: 'https://example.invalid/schema.json' };
    });
    await expect(installer.inspect(source)).rejects.toMatchObject({
      code: RpcErrorCode.PluginManifestInvalid,
    });
  });
});

function createInstaller(platformVersion = '0.1.0'): {
  installer: PluginInstaller;
  profileDir: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-installer-'));
  roots.push(root);
  const profileDir = path.join(root, 'profile');
  mkdirSync(profileDir, { recursive: true });
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  databases.push(database);
  const profile = new ProfileStore(database);
  const projectDatabases = new ProjectDatabases(profile);
  const definitions = createBuiltinSettings();
  const settingsRegistry = new SettingsRegistry();
  settingsRegistry.register('builtin', definitions.groups, definitions.definitions);
  const settings = new SettingsService(settingsRegistry, database, projectDatabases);
  return {
    installer: new PluginInstaller({ database, profileDir, platformVersion, settings }),
    profileDir,
  };
}

function samplePluginPath(): string {
  return path.resolve(__dirname, '../../../plugins/sample-hello');
}

function createManifestFixture(
  parent: string,
  update: (manifest: PluginManifest) => void,
  id = 'fixture-plugin',
): string {
  const root = path.join(parent, id);
  const samplePath = samplePluginPath();
  mkdirSync(path.join(root, 'dist'), { recursive: true });
  mkdirSync(path.join(root, 'panels'), { recursive: true });
  const manifest = JSON.parse(
    readFileSync(path.join(samplePath, 'gamecrafter-plugin.json'), 'utf8'),
  ) as PluginManifest;
  manifest.id = id;
  manifest.name = id;
  manifest.contributes.tools = manifest.contributes.tools.map((tool) => ({
    ...tool,
    toolId: `${id}/greet`,
  }));
  manifest.contributes.ui.commands = [];
  manifest.contributes.settings = manifest.contributes.settings.map((setting) => ({
    ...setting,
    key: `plugin.${id}.greetingPrefix`,
    source: `plugin:${id}`,
  }));
  update(manifest);
  writeFileSync(path.join(root, 'gamecrafter-plugin.json'), JSON.stringify(manifest));
  writeFileSync(path.join(root, 'dist/index.cjs'), 'process.exit(0);');
  writeFileSync(
    path.join(root, 'panels/hello.json'),
    readFileSync(path.join(samplePath, 'panels/hello.json')),
  );
  return root;
}

async function sha256File(filePath: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}
