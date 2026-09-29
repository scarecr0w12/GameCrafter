import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  scrypt as scryptCallback,
  type KeyObject,
} from 'node:crypto';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';
import type { BackupIdentity } from '@gamecrafter/contracts';
import type { ArchiveGcmValue, BackupArchiveHeader } from './types';

function scryptAsync(
  secret: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(secret, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(Buffer.from(derivedKey));
    });
  });
}

const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');
const ARCHIVE_WRAP_INFO = Buffer.from('gamecrafter-backup-v1', 'utf8');

export interface BackupIdentityCryptoMaterial {
  publicKey: string;
  kdf: BackupIdentity['kdf'];
  encryptedPrivateKey: BackupIdentity['encryptedPrivateKey'];
}

export interface ArchiveKeyWrap {
  archiveKey: Buffer;
  headerWithoutWrappedKey: Omit<BackupArchiveHeader, 'wrappedArchiveKey'>;
  wrappedArchiveKey: ArchiveGcmValue;
}

export async function createBackupIdentityCrypto(
  identityId: string,
  secret: string,
  logN: number,
): Promise<BackupIdentityCryptoMaterial> {
  const salt = randomBytes(16);
  const kdf: BackupIdentity['kdf'] = {
    name: 'scrypt',
    salt: salt.toString('base64'),
    logN,
    r: 8,
    p: 1,
  };
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const publicDer = Buffer.from(publicKey.export({ format: 'der', type: 'spki' }));
  const publicBytes = publicDer.subarray(publicDer.length - 32);
  const privateDer = Buffer.from(privateKey.export({ format: 'der', type: 'pkcs8' }));
  const secretKey = await deriveScryptKey(secret, salt, kdf);
  const encryptedPrivateKey = encryptGcm(secretKey, privateDer, Buffer.from(identityId, 'utf8'));
  secretKey.fill(0);
  privateDer.fill(0);
  return {
    publicKey: publicBytes.toString('base64'),
    kdf,
    encryptedPrivateKey,
  };
}

export function createArchiveKeyWrap(
  identity: Pick<BackupIdentity, 'publicKey'>,
  archiveId: string,
  headerWithoutEphemeralAndWrapped: Omit<
    BackupArchiveHeader,
    'ephemeralPublicKey' | 'wrappedArchiveKey'
  >,
): ArchiveKeyWrap {
  const { publicKey: ephemeralPublicKey, privateKey: ephemeralPrivateKey } =
    generateKeyPairSync('x25519');
  const ephemeralPublicKeyBase64 = rawPublicKey(ephemeralPublicKey).toString('base64');
  const headerWithoutWrappedKey: Omit<BackupArchiveHeader, 'wrappedArchiveKey'> = {
    ...headerWithoutEphemeralAndWrapped,
    ephemeralPublicKey: ephemeralPublicKeyBase64,
  };
  const shared = diffieHellman({
    privateKey: ephemeralPrivateKey,
    publicKey: publicKeyFromRaw(Buffer.from(identity.publicKey, 'base64')),
  });
  const wrapKey = deriveWrapKey(shared, archiveId);
  const archiveKey = randomBytes(32);
  const aad = Buffer.from(canonicalJson(headerWithoutWrappedKey), 'utf8');
  const wrappedArchiveKey = encryptGcm(wrapKey, archiveKey, aad);
  shared.fill(0);
  wrapKey.fill(0);
  return { archiveKey, headerWithoutWrappedKey, wrappedArchiveKey };
}

export async function unwrapArchiveKey(
  header: BackupArchiveHeader,
  secret: string,
): Promise<Buffer> {
  const identity = header.identity;
  let privateKey: KeyObject;
  let secretKey: Buffer | undefined;
  let privateDer: Buffer;
  try {
    secretKey = await deriveScryptKey(
      secret,
      Buffer.from(identity.kdf.salt, 'base64'),
      identity.kdf,
    );
    privateDer = decryptGcm(
      secretKey,
      identity.encryptedPrivateKey,
      Buffer.from(header.identityId, 'utf8'),
    );
  } catch {
    secretKey?.fill(0);
    throw new RpcError('Backup identity could not be unlocked.', RpcErrorCode.BackupUnlockFailed);
  }
  secretKey.fill(0);
  try {
    privateKey = createPrivateKey({ key: privateDer, format: 'der', type: 'pkcs8' });
  } catch {
    privateDer.fill(0);
    throw new RpcError('Backup archive private key is invalid.', RpcErrorCode.BackupArchiveCorrupt);
  }
  privateDer.fill(0);

  let shared: Buffer;
  try {
    shared = diffieHellman({
      privateKey,
      publicKey: publicKeyFromRaw(Buffer.from(header.ephemeralPublicKey, 'base64')),
    });
  } catch {
    throw new RpcError(
      'Backup archive key agreement data is invalid.',
      RpcErrorCode.BackupArchiveCorrupt,
    );
  }
  const wrapKey = deriveWrapKey(shared, header.archiveId);
  const headerWithoutWrappedKey = Object.fromEntries(
    Object.entries(header).filter(([key]) => key !== 'wrappedArchiveKey'),
  );
  const aad = Buffer.from(canonicalJson(headerWithoutWrappedKey), 'utf8');
  try {
    return decryptGcm(wrapKey, header.wrappedArchiveKey, aad);
  } catch {
    throw new RpcError(
      'Backup archive key could not be unwrapped.',
      RpcErrorCode.BackupArchiveCorrupt,
    );
  } finally {
    shared.fill(0);
    wrapKey.fill(0);
  }
}

export function encryptGcm(key: Buffer, plaintext: Buffer, aad?: Buffer): ArchiveGcmValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptGcm(key: Buffer, value: ArchiveGcmValue, aad?: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

export function deriveWrapKey(shared: Buffer, archiveId: string): Buffer {
  const key = hkdfSync(
    'sha256',
    shared,
    Buffer.from(archiveId.replaceAll('-', ''), 'hex'),
    ARCHIVE_WRAP_INFO,
    32,
  );
  return Buffer.from(key);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export async function deriveScryptKey(
  secret: string,
  salt: Buffer,
  kdf: Pick<BackupIdentity['kdf'], 'logN' | 'r' | 'p'>,
): Promise<Buffer> {
  const n = 2 ** kdf.logN;
  const maxmem = Math.max(32 * 1024 * 1024, 128 * n * kdf.r + 64 * 1024 * 1024);
  const key = await scryptAsync(secret, salt, 32, {
    N: n,
    r: kdf.r,
    p: kdf.p,
    maxmem,
  });
  return Buffer.from(key as Uint8Array);
}

export function publicKeyFromRaw(raw: Buffer): KeyObject {
  if (raw.length !== 32) throw new Error('X25519 public keys must contain 32 bytes');
  return createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

function rawPublicKey(publicKey: KeyObject): Buffer {
  const der = Buffer.from(publicKey.export({ format: 'der', type: 'spki' }));
  return der.subarray(der.length - 32);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}
