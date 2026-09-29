import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import type { BackupArchiveEntry } from '@gamecrafter/contracts';
import type { BackupDestinationAdapter } from './destinations/destination';
import { BackupDestinationRegistry } from './destinations/registry';
import { BackupService } from './backup-service';
import { Database } from '../db/database';
import { profileMigrations } from '../profile/migrations';
import { migrate } from '../db/migrator';
import { CredentialStore } from '../profile/credential-store';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { ProjectWorkspace } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';

const roots: string[] = [];
const services: Array<{
  backup: BackupService;
  database: Database;
  projectDatabases: ProjectDatabases;
}> = [];

class BlockingDestination implements BackupDestinationAdapter {
  readonly kind = 'local' as const;
  started!: () => void;
  readonly startedPromise = new Promise<void>((resolve) => {
    this.started = resolve;
  });

  async put(
    _archiveName: string,
    _sourceFilePath: string,
    _onProgress?: (bytes: number) => void,
    signal?: AbortSignal,
  ): Promise<{ bytes: number }> {
    this.started();
    await new Promise<void>((resolve) => {
      if (signal?.aborted) return resolve();
      signal?.addEventListener('abort', resolve, { once: true });
    });
    throw signal?.reason ?? new Error('aborted');
  }

  async get(): Promise<Readable> {
    return Readable.from([]);
  }

  async list(): Promise<BackupArchiveEntry[]> {
    return [];
  }

  async delete(): Promise<void> {}

  async probe(): Promise<void> {}
}

afterEach(async () => {
  for (const item of services.splice(0)) {
    await item.backup.stop();
    item.projectDatabases.close();
    item.database.close();
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('BackupService', () => {
  it('cancels an active upload through its AbortSignal', async () => {
    const blocking = new BlockingDestination();
    const destinations = new BackupDestinationRegistry();
    destinations.register('local', () => blocking);
    const { backup } = createBackupEnvironment(destinations);
    const identity = await backup.createIdentity({
      label: 'Cancel identity',
      secret: 'cancel test secret 123',
    });
    const destination = backup.addDestination({
      kind: 'local',
      displayName: 'Blocking destination',
      config: { directory: '/unused' },
    });
    const run = await backup.run({
      scope: 'profile',
      destinationId: destination.destinationId,
      identityId: identity.identityId,
    });
    await blocking.startedPromise;
    const cancelled = await backup.cancel(run.runId);
    expect(cancelled.status).toBe('cancelled');
  }, 30_000);

  it('prunes only after a verified run and never prunes on failure', async () => {
    let currentTime = new Date('2026-09-29T10:00:00.000Z');
    const { backup } = createBackupEnvironment(undefined, () => new Date(currentTime));
    const identity = await backup.createIdentity({
      label: 'Retention identity',
      secret: 'retention test secret 123',
    });
    const archiveDirectory = path.join(roots[roots.length - 1]!, 'archives');
    const destination = backup.addDestination({
      kind: 'local',
      displayName: 'Retention local destination',
      config: { directory: archiveDirectory },
    });
    const plan = backup.savePlan({
      plan: {
        scope: 'profile',
        projectId: null,
        destinationId: destination.destinationId,
        identityId: identity.identityId,
        schedule: { kind: 'manual' },
        retention: { keepLast: 2, keepDays: null },
        enabled: true,
      },
    });
    const completed = [] as Awaited<ReturnType<typeof backup.run>>[];
    for (let index = 0; index < 3; index += 1) {
      const run = await backup.run({ planId: plan.planId });
      completed.push(await waitForRun(backup, run.runId));
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentTime = new Date(currentTime.getTime() + 60_000);
    }
    expect(completed.map((run) => run.status)).toEqual(['verified', 'verified', 'verified']);
    expect(backup.runById(completed[0]!.runId).prunedAt).toEqual(expect.any(String));
    expect(backup.runById(completed[1]!.runId).prunedAt).toBeNull();
    expect(completed[2]?.prunedAt).toBeNull();
    expect(readdirSync(archiveDirectory).filter((name) => name.endsWith('.gcbackup'))).toHaveLength(
      2,
    );

    const blockedPath = path.join(roots[roots.length - 1]!, 'not-a-directory');
    writeFileSync(blockedPath, 'not a directory');
    backup.updateDestination({
      destinationId: destination.destinationId,
      patch: { config: { directory: blockedPath } },
    });
    const failedRun = await backup.run({ planId: plan.planId });
    const failed = await waitForRun(backup, failedRun.runId);
    expect(failed.status).toBe('failed');
    expect(readdirSync(archiveDirectory).filter((name) => name.endsWith('.gcbackup'))).toHaveLength(
      2,
    );
  }, 60_000);
});

function createBackupEnvironment(
  registry?: BackupDestinationRegistry,
  now: () => Date = () => new Date(),
): { backup: BackupService; database: Database; projectDatabases: ProjectDatabases } {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-backup-service-unit-'));
  roots.push(root);
  const profileDir = path.join(root, 'profile');
  mkdirSync(profileDir, { recursive: true });
  const database = Database.open(path.join(profileDir, 'profile.sqlite'));
  migrate(database, profileMigrations);
  const projects = new ProfileStore(database);
  const projectDatabases = new ProjectDatabases(projects);
  const settingsRegistry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
  const settings = new SettingsService(settingsRegistry, database, projectDatabases);
  const credentials = new CredentialStore(database, profileDir, now);
  const workspace = new ProjectWorkspace({ profile: projects, platformVersion: '0.1.0', now });
  const backup = new BackupService({
    database,
    projects,
    projectDatabases,
    workspace,
    credentials,
    settings,
    profileDir,
    platformVersion: '0.1.0',
    pluginVersions: () => ({}),
    events: { runChanged: () => undefined },
    now,
    ...(registry ? { destinationRegistry: registry } : {}),
  });
  services.push({ backup, database, projectDatabases });
  return { backup, database, projectDatabases };
}

async function waitForRun(backup: BackupService, runId: string) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const run = backup.runById(runId);
    if (run.status === 'verified' || run.status === 'failed' || run.status === 'cancelled')
      return run;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Backup run did not finish: ${runId}`);
}
