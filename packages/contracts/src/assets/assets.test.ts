import { describe, expect, it } from 'vitest';
import {
  ASSET_JOB_TRANSITIONS,
  AssetJobSchema,
  AssetPreviewSchema,
  AssetProviderAccountSchema,
  RpcErrorCode,
  RpcMethods,
  RpcNotifications,
  compile,
  isTerminalAssetJobStatus,
  isValidAssetJobTransition,
} from '..';

describe('asset contracts', () => {
  it('round-trips provider accounts, jobs, and previews', () => {
    const accountValidator = compile(AssetProviderAccountSchema);
    const account = {
      schemaVersion: 1 as const,
      accountId: '00000000-0000-7000-8000-000000000001',
      providerKind: 'meshy' as const,
      displayName: 'Meshy account',
      baseUrl: 'https://api.meshy.ai',
      planTier: 'studio',
      hasApiKey: true,
      enabled: true,
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
    };
    expect(accountValidator.assert(account)).toEqual(account);
    expect(accountValidator.check({ ...account, apiKey: 'must-not-be-returned' })).toBe(false);

    const job = {
      schemaVersion: 1 as const,
      jobId: '00000000-0000-7000-8000-000000000002',
      projectId: '00000000-0000-7000-8000-000000000003',
      providerKind: 'meshy' as const,
      accountId: account.accountId,
      status: 'review' as const,
      progress: 100,
      providerTaskId: 'task-1',
      error: null,
      artifacts: [
        {
          artifactId: '00000000-0000-7000-8000-000000000004',
          jobId: '00000000-0000-7000-8000-000000000002',
          kind: 'model' as const,
          format: 'glb',
          path: '.gamecrafter/asset-jobs/00000000-0000-7000-8000-000000000002/model.glb',
          sha256: 'a'.repeat(64),
          bytes: 12,
          downloadedAt: '2026-09-29T00:01:00.000Z',
        },
      ],
      provenance: {
        providerKind: 'meshy' as const,
        accountId: account.accountId,
        providerTaskId: 'task-1',
        planTier: 'studio',
        request: { kind: 'text-to-3d' as const, prompt: 'A lantern', outputFormat: 'glb' as const },
        submittedAt: '2026-09-29T00:00:00.000Z',
        completedAt: '2026-09-29T00:01:00.000Z',
        creditsConsumed: 8,
        termsSnapshot: {
          url: 'https://help.meshy.ai/en/articles/16102098-can-i-use-meshy-assets-commercially',
          capturedAt: '2026-09-29T00:00:00.000Z',
          note: 'Rights depend on the plan and terms in effect when the asset is generated.',
        },
        requestedBy: { kind: 'user' as const, ref: null },
      },
      review: { decision: null, note: null, decidedAt: null },
      importedPath: null,
      taskId: null,
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:01:00.000Z',
    };
    expect(compile(AssetJobSchema).assert(job)).toEqual(job);

    const preview = {
      schemaVersion: 1 as const,
      previewId: '00000000-0000-7000-8000-000000000005',
      projectId: job.projectId,
      sourcePath: 'game/assets/lantern.glb',
      sourceSha256: 'b'.repeat(64),
      sourceBytes: 12,
      kind: 'model-gltf' as const,
      derivativePath:
        '.gamecrafter/cache/asset-previews/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.glb',
      mimeType: 'model/gltf-binary',
      warnings: [],
      metadata: { gltfVersion: '2.0', nodes: 1, meshes: 1, materials: 1, animations: ['Open'] },
      createdAt: '2026-09-29T00:01:00.000Z',
    };
    expect(compile(AssetPreviewSchema).assert(preview)).toEqual(preview);
  });

  it('defines every transition and identifies terminal statuses', () => {
    const statuses = Object.keys(ASSET_JOB_TRANSITIONS).sort();
    expect(statuses).toEqual([
      'approved',
      'cancelled',
      'downloading',
      'expired',
      'failed',
      'imported',
      'queued',
      'rejected',
      'review',
      'running',
      'submitted',
    ]);
    expect(
      Object.values(ASSET_JOB_TRANSITIONS)
        .flat()
        .every((status) => statuses.includes(status)),
    ).toBe(true);
    expect(
      statuses.filter((status) =>
        isTerminalAssetJobStatus(status as keyof typeof ASSET_JOB_TRANSITIONS),
      ),
    ).toEqual(['cancelled', 'expired', 'failed', 'imported']);
    expect(isValidAssetJobTransition('queued', 'submitted')).toBe(true);
    expect(isValidAssetJobTransition('review', 'approved')).toBe(true);
    expect(isValidAssetJobTransition('review', 'imported')).toBe(false);
    expect(
      Object.entries(ASSET_JOB_TRANSITIONS).every(
        ([status, next]) =>
          isTerminalAssetJobStatus(status as keyof typeof ASSET_JOB_TRANSITIONS) ===
          (next.length === 0),
      ),
    ).toBe(true);
  });

  it('declares asset RPC methods, notifications, and unique error codes', () => {
    expect(Object.keys(RpcMethods).filter((name) => name.startsWith('asset/'))).toEqual([
      'asset/providers',
      'asset/accounts',
      'asset/addAccount',
      'asset/updateAccount',
      'asset/removeAccount',
      'asset/testAccount',
      'asset/generate',
      'asset/jobs',
      'asset/job',
      'asset/cancel',
      'asset/review',
      'asset/import',
      'asset/files',
      'asset/preview',
      'asset/openInAuthoringTool',
    ]);
    expect(RpcNotifications['asset/jobChanged']).toBeDefined();
    const values = Object.values(RpcErrorCode);
    expect(new Set(values).size).toBe(values.length);
    expect([
      RpcErrorCode.AssetProviderAccountNotFound,
      RpcErrorCode.AssetJobNotFound,
      RpcErrorCode.AssetJobInvalidTransition,
      RpcErrorCode.AssetProviderRequestFailed,
      RpcErrorCode.AssetDownloadTooLarge,
      RpcErrorCode.AssetPathOutsideProject,
      RpcErrorCode.AssetPreviewUnavailable,
    ]).toHaveLength(7);
  });
});
