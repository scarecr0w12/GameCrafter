import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createReleaseManifest,
  parseChecksums,
  signContents,
  verifyContents,
  writeChecksums,
} from './release-tools';

let directory: string | undefined;

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('release tools', () => {
  it('writes sorted SHA256SUMS entries and verifies Ed25519 signatures including tamper detection', async () => {
    directory = mkdtempSync(path.join(tmpdir(), 'gc-release-tools-'));
    writeFileSync(path.join(directory, 'z-package.deb'), 'deb bytes');
    writeFileSync(path.join(directory, 'a-package.AppImage'), 'appimage bytes');

    const checksumsPath = await writeChecksums(directory);
    const checksums = readFileSync(checksumsPath, 'utf8');
    const parsed = parseChecksums(checksums);
    const expected = createHash('sha256').update('appimage bytes').digest('hex');
    expect([...parsed.keys()]).toEqual(['a-package.AppImage', 'z-package.deb']);
    expect(parsed.get('a-package.AppImage')).toBe(expected);

    const keys = generateKeyPairSync('ed25519');
    const privateKey = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicKey = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const signature = signContents(Buffer.from(checksums), privateKey);
    expect(verifyContents(Buffer.from(checksums), signature, publicKey)).toBe(true);
    expect(verifyContents(Buffer.from(`${checksums}tampered`), signature, publicKey)).toBe(false);
  });

  it('builds a schema-valid release manifest with platform compatibility metadata', () => {
    const manifest = createReleaseManifest({
      version: '1.2.3',
      tag: 'v1.2.3',
      commit: 'a'.repeat(40),
      builtAt: '2026-09-30T00:00:00.000Z',
      platforms: [
        {
          os: 'linux',
          arch: 'x64',
          asset: 'GameCrafter-1.2.3.deb',
          sha256: 'b'.repeat(64),
          kind: 'deb',
        },
      ],
      compatibility: {
        profileSchemaVersion: 11,
        projectSchemaVersion: 11,
        minUpgradeFromVersion: '0.1.0',
      },
      notes: 'Fixes and improvements.',
    });
    expect(manifest).toMatchObject({ schemaVersion: 1, version: '1.2.3', tag: 'v1.2.3' });
  });
});
