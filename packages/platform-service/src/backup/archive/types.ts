import type { BackupManifest, BackupManifestEntry, BackupScope } from '@gamecrafter/contracts';

export interface ArchiveGcmValue {
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface ArchiveIdentityCopy {
  publicKey: string;
  kdf: {
    name: 'scrypt';
    salt: string;
    logN: number;
    r: number;
    p: number;
  };
  encryptedPrivateKey: ArchiveGcmValue;
}

export interface BackupArchiveHeader {
  archiveId: string;
  scope: BackupScope;
  projectId: string | null;
  createdAt: string;
  identityId: string;
  identity: ArchiveIdentityCopy;
  ephemeralPublicKey: string;
  wrappedArchiveKey: ArchiveGcmValue;
  chunkBytes: number;
  compression: 'gzip';
  manifestOffset: null;
}

export type ArchiveRecordKind = BackupManifestEntry['kind'] | 'manifest-preview' | 'manifest';

export interface BackupArchiveWriteEntry {
  path: string;
  kind: ArchiveRecordKind;
  bytes: number;
  mode: number;
  mtime: string;
  sha256?: string | null;
  linkTarget?: string;
  content?: Buffer | AsyncIterable<Uint8Array>;
}

export interface BackupArchiveReadEntry {
  path: string;
  kind: ArchiveRecordKind;
  bytes: number;
  mode: number;
  mtime: string;
  sha256?: string | null;
  linkTarget?: string;
}

export interface BackupArchiveReadOptions {
  manifestOnly?: boolean;
  onEntry?: (entry: BackupArchiveReadEntry, content: AsyncIterable<Buffer>) => Promise<void> | void;
}

export interface BackupArchiveReadResult {
  header: BackupArchiveHeader;
  manifest: BackupManifest;
}
