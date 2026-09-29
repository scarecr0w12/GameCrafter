import { createCipheriv, createHash } from 'node:crypto';
import { PassThrough, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import type { BackupIdentity, BackupManifest } from '@gamecrafter/contracts';
import { canonicalJson, createArchiveKeyWrap } from './crypto';
import type { BackupArchiveHeader, BackupArchiveWriteEntry } from './types';

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_CHUNK_BYTES = 1_048_576;

const MAGIC = Buffer.from('GCBK', 'ascii');

type WriterInput = BackupArchiveWriteEntry;

export interface BackupArchiveWriter extends Writable {
  readonly archiveKey: Buffer;
  readonly header: BackupArchiveHeader;
}

export interface BackupArchiveWriterOptions {
  identity: BackupIdentity;
  manifest: BackupManifest;
  compressionLevel: number;
}

export function createArchiveWriter(
  destination: Writable,
  options: BackupArchiveWriterOptions,
): BackupArchiveWriter {
  const manifestContent = Buffer.from(canonicalJson(options.manifest), 'utf8');
  if (manifestContent.length > BACKUP_CHUNK_BYTES / 2) {
    throw new Error('Backup manifest is too large for the authenticated preview chunk.');
  }
  const manifestDigest = createHash('sha256').update(manifestContent).digest('hex');
  const plaintext = new PassThrough();
  const headerBase: Omit<BackupArchiveHeader, 'ephemeralPublicKey' | 'wrappedArchiveKey'> = {
    archiveId: options.manifest.archiveId,
    scope: options.manifest.scope,
    projectId: options.manifest.projectId,
    createdAt: options.manifest.createdAt,
    identityId: options.identity.identityId,
    identity: {
      publicKey: options.identity.publicKey,
      kdf: options.identity.kdf,
      encryptedPrivateKey: options.identity.encryptedPrivateKey,
    },
    chunkBytes: BACKUP_CHUNK_BYTES,
    compression: 'gzip',
    manifestOffset: null,
  };
  const wrapped = createArchiveKeyWrap(options.identity, options.manifest.archiveId, headerBase);
  const header: BackupArchiveHeader = {
    ...wrapped.headerWithoutWrappedKey,
    wrappedArchiveKey: wrapped.wrappedArchiveKey,
  };
  const headerBytes = Buffer.from(canonicalJson(header), 'utf8');
  if (headerBytes.length > 1024 * 1024) throw new Error('Backup archive header is too large');
  const prefix = Buffer.alloc(9);
  MAGIC.copy(prefix, 0);
  prefix.writeUInt8(BACKUP_FORMAT_VERSION, 4);
  prefix.writeUInt32BE(headerBytes.length, 5);
  destination.write(Buffer.concat([prefix, headerBytes]));

  const cipherTransform = createChunkEncryptor(wrapped.archiveKey, BACKUP_CHUNK_BYTES);
  const pump = pipeline(
    plaintext,
    createGzip({ level: options.compressionLevel }),
    cipherTransform,
    destination,
  );
  void pump.catch(() => undefined);

  const previewEntry: BackupArchiveWriteEntry = {
    kind: 'manifest-preview',
    path: 'manifest.json',
    bytes: manifestContent.length,
    mode: 0o600,
    mtime: options.manifest.createdAt,
    sha256: manifestDigest,
    content: manifestContent,
  };
  const startPromise = writeEntry(plaintext, previewEntry);

  const writer = new Writable({
    objectMode: true,
    write(entry: WriterInput, _encoding, callback) {
      void startPromise
        .then(() => writeEntry(plaintext, entry))
        .then(
          () => callback(),
          (error: unknown) => callback(asError(error)),
        );
    },
    final(callback) {
      void startPromise
        .then(() => writeEntry(plaintext, { ...previewEntry, kind: 'manifest' }))
        .then(() => {
          plaintext.end();
          return pump;
        })
        .then(
          () => callback(),
          (error: unknown) => callback(asError(error)),
        );
    },
    destroy(error, callback) {
      if (error) plaintext.destroy(error);
      callback(error);
    },
  }) as BackupArchiveWriter;
  Object.defineProperties(writer, {
    archiveKey: { value: wrapped.archiveKey, enumerable: true },
    header: { value: header, enumerable: true },
  });
  return writer;
}

async function writeEntry(stream: PassThrough, entry: BackupArchiveWriteEntry): Promise<void> {
  const record: BackupArchiveWriteEntry = {
    path: entry.path,
    kind: entry.kind,
    bytes: entry.bytes,
    mode: entry.mode,
    mtime: entry.mtime,
    ...(entry.sha256 === undefined ? {} : { sha256: entry.sha256 }),
    ...(entry.linkTarget === undefined ? {} : { linkTarget: entry.linkTarget }),
  };
  const json = Buffer.from(JSON.stringify(record), 'utf8');
  if (json.length > 1024 * 1024) throw new Error('Backup entry header is too large');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length);
  await writeBuffer(stream, length);
  await writeBuffer(stream, json);

  if (entry.kind !== 'file' && entry.kind !== 'manifest' && entry.kind !== 'manifest-preview') {
    if (entry.bytes !== 0)
      throw new Error('Backup directory and symlink entries cannot contain file data');
    return;
  }
  if (entry.bytes > 0 && !entry.content) throw new Error('Backup file content is missing');
  let bytesWritten = 0;
  if (Buffer.isBuffer(entry.content)) {
    bytesWritten = entry.content.length;
    await writeBuffer(stream, entry.content);
  } else if (entry.content) {
    for await (const chunk of entry.content) {
      const data = Buffer.from(chunk);
      bytesWritten += data.length;
      await writeBuffer(stream, data);
    }
  }
  if (bytesWritten !== entry.bytes) {
    throw new Error(
      `Backup entry length mismatch for ${entry.path}: expected ${entry.bytes}, got ${bytesWritten}`,
    );
  }
}

async function writeBuffer(stream: PassThrough, bytes: Buffer): Promise<void> {
  if (bytes.length === 0) return;
  if (stream.write(bytes)) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      stream.off('drain', onDrain);
      stream.off('error', onError);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

function createChunkEncryptor(archiveKey: Buffer, chunkBytes: number): Transform {
  let pending = Buffer.alloc(0);
  let chunkIndex = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      pending = pending.length ? Buffer.concat([pending, chunk]) : Buffer.from(chunk);
      while (pending.length > chunkBytes) {
        this.push(encryptChunk(archiveKey, pending.subarray(0, chunkBytes), chunkIndex, false));
        pending = pending.subarray(chunkBytes);
        chunkIndex += 1;
      }
      callback();
    },
    flush(callback) {
      this.push(encryptChunk(archiveKey, pending, chunkIndex, true));
      pending.fill(0);
      callback();
    },
  });
}

function encryptChunk(
  archiveKey: Buffer,
  plaintext: Buffer,
  chunkIndex: number,
  isLast: boolean,
): Buffer {
  const iv = Buffer.alloc(12);
  iv.writeBigUInt64BE(BigInt(chunkIndex), 4);
  const aad = Buffer.alloc(9);
  aad.writeBigUInt64BE(BigInt(chunkIndex), 0);
  aad.writeUInt8(Number(isLast), 8);
  const cipher = createCipheriv('aes-256-gcm', archiveKey, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(ciphertext.length);
  return Buffer.concat([length, ciphertext]);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
