import { describe, expect, it } from 'vitest';
import {
  BackupDestinationSchema,
  BackupIdentitySchema,
  BackupManifestSchema,
  BackupPlanSchema,
  BackupRestoreResultSchema,
  BackupRunSchema,
  BackupVerifyResultSchema,
  RpcErrorCode,
  RpcMethods,
  RpcNotifications,
  compile,
} from '..';

const now = '2026-09-29T12:00:00.000Z';
const projectId = '019535d4-2c00-7000-8000-000000000001';
const destinationId = '019535d4-2c00-7000-8000-000000000002';
const identityId = '019535d4-2c00-7000-8000-000000000003';
const planId = '019535d4-2c00-7000-8000-000000000004';
const runId = '019535d4-2c00-7000-8000-000000000005';
const archiveId = '019535d4-2c00-7000-8000-000000000006';
const manifest = {
  schemaVersion: 1 as const,
  archiveId,
  scope: 'project' as const,
  projectId,
  createdAt: now,
  platformVersion: '0.1.0',
  schemaVersions: { profile: 9, project: 8 },
  pluginVersions: { 'org.example.sample': '1.2.0' },
  entries: [
    {
      path: 'game/README.md',
      kind: 'file' as const,
      bytes: 4,
      mode: 0o644,
      mtime: now,
      sha256: 'a'.repeat(64),
    },
  ],
  excluded: ['.gamecrafter/cache/'],
  notes: ['Git internals are captured as files at a point in time.'],
};

const identity = {
  schemaVersion: 1 as const,
  identityId,
  label: 'Studio recovery key',
  publicKey: Buffer.alloc(32).toString('base64'),
  kdf: {
    name: 'scrypt' as const,
    salt: Buffer.alloc(16).toString('base64'),
    logN: 15,
    r: 8,
    p: 1,
  },
  encryptedPrivateKey: {
    iv: Buffer.alloc(12).toString('base64'),
    ciphertext: Buffer.alloc(48).toString('base64'),
    tag: Buffer.alloc(16).toString('base64'),
  },
  createdAt: now,
};

const destination = {
  schemaVersion: 1 as const,
  destinationId,
  kind: 'local' as const,
  displayName: 'USB archive drive',
  config: { directory: '/tmp/gamecrafter-backups' },
  hasSecrets: false,
  enabled: true,
  createdAt: now,
  updatedAt: now,
};

const run = {
  schemaVersion: 1 as const,
  runId,
  planId,
  scope: 'project' as const,
  projectId,
  destinationId,
  identityId,
  archiveId,
  archiveName: `project-${projectId}-${now.replace(/[:.]/g, '-')}-${archiveId.slice(0, 8)}.gcbackup`,
  status: 'verified' as const,
  bytes: 2048,
  sha256: 'b'.repeat(64),
  files: 1,
  startedAt: now,
  finishedAt: now,
  verifiedAt: now,
  drilledAt: now,
  prunedAt: null,
  error: null,
  trigger: 'manual' as const,
};

describe('backup contracts', () => {
  it('round-trips identities, destinations, plans, runs, manifests, and results', () => {
    expect(compile(BackupIdentitySchema).assert(identity)).toEqual(identity);
    expect(compile(BackupDestinationSchema).assert(destination)).toEqual(destination);

    const plan = {
      schemaVersion: 1 as const,
      planId,
      scope: 'project' as const,
      projectId,
      destinationId,
      identityId,
      schedule: { kind: 'interval' as const, everyMinutes: 60 },
      retention: { keepLast: 3, keepDays: 30 },
      enabled: true,
      lastRunAt: null,
      nextRunAt: now,
      createdAt: now,
      updatedAt: now,
    };
    expect(compile(BackupPlanSchema).assert(plan)).toEqual(plan);
    expect(compile(BackupRunSchema).assert(run)).toEqual(run);
    expect(compile(BackupManifestSchema).assert(manifest)).toEqual(manifest);

    const restored = {
      targetPath: '/tmp/restored-project',
      scope: 'project' as const,
      projectId,
      registeredProjectId: projectId,
      manifest,
      warnings: [],
    };
    expect(compile(BackupRestoreResultSchema).assert(restored)).toEqual(restored);
    const verified = {
      ok: true,
      archiveName: run.archiveName,
      bytes: run.bytes,
      sha256: run.sha256,
      files: run.files,
      warnings: [],
      error: null,
    };
    expect(compile(BackupVerifyResultSchema).assert(verified)).toEqual(verified);
    expect(
      compile(BackupDestinationSchema).check({ ...destination, secrets: { password: 'hidden' } }),
    ).toBe(false);
  });

  it('declares backup RPC methods, notifications, and unique error codes', () => {
    expect(Object.keys(RpcMethods).filter((name) => name.startsWith('backup/'))).toEqual([
      'backup/identities',
      'backup/identity/create',
      'backup/identity/remove',
      'backup/destinations',
      'backup/addDestination',
      'backup/updateDestination',
      'backup/removeDestination',
      'backup/testDestination',
      'backup/plans',
      'backup/savePlan',
      'backup/removePlan',
      'backup/run',
      'backup/runs',
      'backup/run/get',
      'backup/cancel',
      'backup/archives',
      'backup/inspect',
      'backup/verify',
      'backup/restore',
    ]);
    expect(RpcNotifications['backup/runChanged']).toBeDefined();
    const values = Object.values(RpcErrorCode);
    expect(new Set(values).size).toBe(values.length);
    expect([
      RpcErrorCode.BackupIdentityNotFound,
      RpcErrorCode.BackupDestinationNotFound,
      RpcErrorCode.BackupPlanNotFound,
      RpcErrorCode.BackupRunNotFound,
      RpcErrorCode.BackupArchiveNotFound,
      RpcErrorCode.BackupUnlockFailed,
      RpcErrorCode.BackupArchiveCorrupt,
      RpcErrorCode.BackupDestinationFailed,
      RpcErrorCode.BackupTargetNotEmpty,
    ]).toHaveLength(9);
  });
});
