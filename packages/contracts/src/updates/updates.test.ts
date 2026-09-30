import { describe, expect, it } from 'vitest';
import { compile } from '../validation';
import { uuidv7 } from '../ids';
import { RpcErrorCode, RpcMethods, RpcNotifications } from '../rpc/protocol';
import { ReleaseManifestSchema, UpdateStateSchema } from './schema';

const now = '2026-09-30T00:00:00.000Z';

function manifest() {
  return {
    schemaVersion: 1,
    version: '1.2.3',
    tag: 'v1.2.3',
    commit: 'a'.repeat(40),
    builtAt: now,
    platforms: [
      {
        os: 'linux',
        arch: 'x64',
        asset: 'GameCrafter-1.2.3.AppImage',
        sha256: 'b'.repeat(64),
        kind: 'appimage',
      },
    ],
    compatibility: {
      profileSchemaVersion: 11,
      projectSchemaVersion: 11,
      minUpgradeFromVersion: '0.1.0',
    },
    notes: '',
  };
}

describe('update contracts', () => {
  it('validates release manifests and update state with unavailable signatures', () => {
    const release = manifest();
    const state = {
      schemaVersion: 1,
      currentVersion: '0.1.0',
      channel: 'stable',
      lastCheckedAt: null,
      available: {
        version: release.version,
        tag: release.tag,
        notes: release.notes,
        asset: {
          name: release.platforms[0]!.asset,
          url: 'https://updates.invalid/GameCrafter-1.2.3.AppImage',
          bytes: 12,
          sha256: release.platforms[0]!.sha256,
          kind: 'appimage',
        },
        manifest: release,
      },
      downloaded: {
        version: release.version,
        path: '/tmp/GameCrafter-1.2.3.AppImage',
        verified: { sha256: true, signature: 'unavailable' },
      },
      compatibility: { ok: true, reasons: [] },
      previous: null,
      error: null,
    };
    expect(compile(ReleaseManifestSchema).check(release)).toBe(true);
    expect(compile(UpdateStateSchema).check(state)).toBe(true);
    expect(compile(UpdateStateSchema).check({ ...state, channel: 'nightly' })).toBe(false);
  });

  it('registers typed update RPCs, notification, and verification errors', () => {
    expect(compile(RpcMethods['update/check'].params).check({})).toBe(true);
    expect(compile(RpcMethods['update/download'].params).check({})).toBe(true);
    expect(compile(RpcMethods['update/dismiss'].params).check({ version: '1.2.3' })).toBe(true);
    expect(RpcNotifications['update/stateChanged']).toBeDefined();
    expect(new Set(Object.values(RpcErrorCode)).size).toBe(Object.values(RpcErrorCode).length);
    expect(RpcErrorCode.UpdateVerificationFailed).toBeDefined();
    expect(uuidv7()).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
