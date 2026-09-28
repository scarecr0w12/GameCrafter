import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectManifest, RpcError, RpcErrorCode, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { projectMigrations } from '../projects/migrations';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from './definitions';
import { SettingsRegistry } from './registry';
import { SettingsService } from './settings-service';

interface Fixture {
  directory: string;
  projectId: string;
  sessionId: string;
  database: Database;
  projectDatabases: ProjectDatabases;
  service: SettingsService;
}

const fixtures: Fixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.projectDatabases.close();
    fixture.database.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

describe('SettingsService', () => {
  it('resolves default, platform, Project, and session layers in precedence order', () => {
    const fixture = createFixture();
    fixture.service.set('access.mode', 'platform', 'restricted');
    fixture.service.set('access.mode', 'project', 'full', { projectId: fixture.projectId });
    fixture.service.set('access.mode', 'session', 'ask-always', { sessionId: fixture.sessionId });

    expect(
      fixture.service.resolve('access.mode', {
        projectId: fixture.projectId,
        sessionId: fixture.sessionId,
      }),
    ).toEqual({
      key: 'access.mode',
      value: 'ask-always',
      source: 'session',
      layers: {
        default: 'ask-always',
        platform: 'restricted',
        project: 'full',
        session: 'ask-always',
      },
    });
  });

  it('clears a null override and falls back to the next available layer', () => {
    const fixture = createFixture();
    fixture.service.set('access.mode', 'platform', 'restricted');
    const inherited = fixture.service.set('access.mode', 'platform', null);

    expect(inherited).toMatchObject({ value: 'ask-always', source: 'default' });
    expect(inherited.layers.platform).toBeUndefined();
  });

  it('rejects scopes that are not allowed for a setting', () => {
    const fixture = createFixture();

    expectRpcError(
      () =>
        fixture.service.set('window.closeBehavior', 'project', 'stop-and-checkpoint', {
          projectId: fixture.projectId,
        }),
      RpcErrorCode.SettingScopeNotAllowed,
    );
  });

  it('rejects values that do not satisfy the setting schema', () => {
    const fixture = createFixture();

    expectRpcError(
      () => fixture.service.set('models.budget.maxCostPerTaskUsd', 'platform', 'five'),
      RpcErrorCode.InvalidSettingValue,
    );
  });

  it('rejects unknown settings and unknown sessions', () => {
    const fixture = createFixture();

    expectRpcError(() => fixture.service.resolve('missing.setting'), RpcErrorCode.UnknownSetting);
    expectRpcError(
      () =>
        fixture.service.set('access.mode', 'session', 'restricted', {
          sessionId: '019535d4-2c00-7000-8000-000000000099',
        }),
      RpcErrorCode.UnknownSession,
    );
  });

  it('drops session values when the session is closed', () => {
    const fixture = createFixture();
    fixture.service.set('access.mode', 'session', 'restricted', { sessionId: fixture.sessionId });
    fixture.service.closeSession(fixture.sessionId);

    expectRpcError(
      () => fixture.service.resolve('access.mode', { sessionId: fixture.sessionId }),
      RpcErrorCode.UnknownSession,
    );
  });
});

function createFixture(): Fixture {
  const directory = mkdtempSync(path.join(tmpdir(), 'gc-settings-'));
  const projectId = uuidv7();
  const projectPath = path.join(directory, 'project');
  const stateDirectory = path.join(projectPath, '.gamecrafter');
  mkdirSync(stateDirectory, { recursive: true });
  const createdAt = new Date().toISOString();
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId,
    name: 'Settings Test',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt,
    createdByPlatformVersion: '0.1.0',
  });
  writeFileSync(
    path.join(projectPath, 'gamecrafter.project.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const projectDatabase = Database.open(path.join(stateDirectory, 'project.sqlite'));
  try {
    migrate(projectDatabase, projectMigrations);
  } finally {
    projectDatabase.close();
  }

  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const profile = new ProfileStore(database);
  profile.register(summaryFromManifest(manifest, projectPath, null));
  const projectDatabases = new ProjectDatabases(profile);
  const registry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  registry.register('builtin', builtins.groups, builtins.definitions);
  const sessionId = uuidv7();
  const service = new SettingsService(registry, database, projectDatabases);
  service.openSession(sessionId);
  const fixture = { directory, projectId, sessionId, database, projectDatabases, service };
  fixtures.push(fixture);
  return fixture;
}

function expectRpcError(operation: () => unknown, code: number): void {
  try {
    operation();
    throw new Error('Expected an RPC error');
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).code).toBe(code);
  }
}
