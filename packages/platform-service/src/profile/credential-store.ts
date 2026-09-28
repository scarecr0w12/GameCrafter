import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Database } from '../db/database';

interface CredentialRow {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
}

export class CredentialStore {
  private key?: Buffer;

  constructor(
    private readonly database: Database,
    private readonly profileDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  put(ref: string, secret: string): void {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    this.database
      .prepare(
        `INSERT INTO credentials (ref, ciphertext, iv, tag, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(ref) DO UPDATE SET
           ciphertext = excluded.ciphertext,
           iv = excluded.iv,
           tag = excluded.tag,
           updated_at = excluded.updated_at`,
      )
      .run(ref, ciphertext, iv, tag, this.now().toISOString());
  }

  get(ref: string): string | undefined {
    const row = this.database
      .prepare('SELECT ciphertext, iv, tag FROM credentials WHERE ref = ?')
      .get<CredentialRow>(ref);
    if (!row) return undefined;
    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(row.iv));
    decipher.setAuthTag(Buffer.from(row.tag));
    return Buffer.concat([decipher.update(Buffer.from(row.ciphertext)), decipher.final()]).toString(
      'utf8',
    );
  }

  delete(ref: string): void {
    this.database.prepare('DELETE FROM credentials WHERE ref = ?').run(ref);
  }

  private getKey(): Buffer {
    if (this.key) return this.key;
    mkdirSync(this.profileDir, { recursive: true, mode: 0o700 });
    const keyPath = path.join(this.profileDir, 'credentials.key');
    try {
      this.key = readFileSync(keyPath);
    } catch (error) {
      if (!isCode(error, 'ENOENT')) throw error;
      const createdKey = randomBytes(32);
      try {
        writeFileSync(keyPath, createdKey, { flag: 'wx', mode: 0o600 });
        this.key = createdKey;
      } catch (writeError) {
        if (!isCode(writeError, 'EEXIST')) throw writeError;
        this.key = readFileSync(keyPath);
      }
    }
    if (this.key.length !== 32) throw new Error('Credential encryption key must contain 32 bytes');
    if (process.platform !== 'win32') chmodSync(keyPath, 0o600);
    return this.key;
  }
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
