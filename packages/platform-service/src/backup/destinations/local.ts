import {
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { BackupArchiveEntry, BackupDestinationConfig } from '@gamecrafter/contracts';
import {
  assertArchiveName,
  type BackupDestinationAdapter,
  type BackupProgress,
} from './destination';

export class LocalBackupDestination implements BackupDestinationAdapter {
  readonly kind = 'local' as const;
  private readonly directory: string;

  constructor(config: BackupDestinationConfig) {
    if (!('directory' in config)) throw new Error('Local destination requires a directory');
    this.directory = path.resolve(config.directory);
  }

  async put(
    archiveName: string,
    sourceFilePath: string,
    onProgress?: BackupProgress,
    signal?: AbortSignal,
  ): Promise<{ bytes: number }> {
    assertArchiveName(archiveName);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const targetPath = path.join(this.directory, archiveName);
    if (existsSync(targetPath)) throw new Error('Backup archive already exists');
    const temporaryPath = path.join(this.directory, `.${archiveName}.${randomUUID()}.partial`);
    let bytes = 0;
    const source = createReadStream(sourceFilePath);
    source.on('data', (chunk) => {
      bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      onProgress?.(bytes);
    });
    try {
      await pipeline(source, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }), {
        signal,
      });
      if (existsSync(targetPath)) throw new Error('Backup archive already exists');
      renameSync(temporaryPath, targetPath);
      return { bytes };
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  async get(
    archiveName: string,
    signal?: AbortSignal,
  ): Promise<ReturnType<typeof createReadStream>> {
    assertArchiveName(archiveName);
    if (signal?.aborted) throw signal.reason;
    const targetPath = path.join(this.directory, archiveName);
    if (!existsSync(targetPath) || !lstatSync(targetPath).isFile()) {
      throw new Error('Backup archive not found');
    }
    return createReadStream(targetPath);
  }

  async list(): Promise<BackupArchiveEntry[]> {
    if (!existsSync(this.directory)) return [];
    const entries: BackupArchiveEntry[] = [];
    for (const archiveName of readdirSync(this.directory)) {
      if (!archiveName.endsWith('.gcbackup')) continue;
      const targetPath = path.join(this.directory, archiveName);
      const stat = lstatSync(targetPath);
      if (!stat.isFile()) continue;
      entries.push({
        archiveName,
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
    return entries.sort((left, right) =>
      (right.modifiedAt ?? '').localeCompare(left.modifiedAt ?? ''),
    );
  }

  async delete(archiveName: string): Promise<void> {
    assertArchiveName(archiveName);
    rmSync(path.join(this.directory, archiveName), { force: true });
  }

  async probe(): Promise<void> {
    const probeDirectory = await mkdtemp(path.join(tmpdir(), 'gc-backup-probe-'));
    const sourcePath = path.join(probeDirectory, 'probe.bin');
    const archiveName = `probe-${randomUUID()}.gcbackup`;
    let uploaded = false;
    try {
      const expected = Buffer.alloc(1024, 0x47);
      await writeFile(sourcePath, expected);
      await this.put(archiveName, sourcePath);
      uploaded = true;
      const stream = await this.get(archiveName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      if (!Buffer.concat(chunks).equals(expected))
        throw new Error('Local destination probe did not round-trip');
    } finally {
      if (uploaded) await this.delete(archiveName);
      await rm(probeDirectory, { recursive: true, force: true });
    }
  }
}
