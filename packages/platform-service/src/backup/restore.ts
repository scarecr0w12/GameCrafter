import { createHash } from 'node:crypto';
import {
  chmodSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
} from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { RpcError, RpcErrorCode, type BackupManifest } from '@gamecrafter/contracts';
import { readArchive, type ArchiveSource } from './archive/reader';
import type { BackupArchiveReadEntry } from './archive/types';

export interface ExtractBackupOptions {
  source: ArchiveSource;
  secret: string;
  targetPath: string;
}

export interface ExtractBackupResult {
  manifest: BackupManifest;
  warnings: string[];
}

export async function extractBackupToDirectory(
  options: ExtractBackupOptions,
): Promise<ExtractBackupResult> {
  const targetPath = path.resolve(options.targetPath);
  mkdirSync(targetPath, { recursive: true });
  const warnings: string[] = [];
  const seen = new Map<string, BackupArchiveReadEntry>();
  const symlinkPaths = new Set<string>();
  const directoryPaths: Array<{ path: string; mode: number; mtime: string }> = [];
  const { manifest } = await readArchive(options.source, options.secret, {
    onEntry: async (entry, content) => {
      const relative = validateRelativePath(entry.path);
      const absolute = resolveInside(targetPath, relative);
      if (hasSymlinkParent(relative, symlinkPaths)) {
        throw new RpcError(
          'Backup entry traverses a restored symbolic link.',
          RpcErrorCode.BackupArchiveCorrupt,
        );
      }
      if (seen.has(relative)) {
        throw new RpcError(
          'Backup archive contains duplicate paths.',
          RpcErrorCode.BackupArchiveCorrupt,
        );
      }
      seen.set(relative, entry);

      if (entry.kind === 'dir') {
        await drain(content);
        mkdirSync(absolute, { recursive: true });
        directoryPaths.push({ path: absolute, mode: entry.mode, mtime: entry.mtime });
        return;
      }
      if (entry.kind === 'symlink') {
        await drain(content);
        const target = entry.linkTarget;
        if (!target || !isLinkInsideTarget(targetPath, absolute, target)) {
          warnings.push(`Skipped unsafe symbolic link: ${relative}`);
          return;
        }
        mkdirSync(path.dirname(absolute), { recursive: true });
        symlinkSync(target, absolute);
        symlinkPaths.add(relative);
        return;
      }
      if (entry.kind !== 'file') {
        await drain(content);
        throw new RpcError('Unexpected backup payload entry.', RpcErrorCode.BackupArchiveCorrupt);
      }
      mkdirSync(path.dirname(absolute), { recursive: true });
      if (existsSync(absolute)) {
        throw new RpcError(
          'Backup archive contains duplicate paths.',
          RpcErrorCode.BackupArchiveCorrupt,
        );
      }
      const hash = createHash('sha256');
      let bytes = 0;
      const checkedContent = Readable.from(
        (async function* () {
          for await (const chunk of content) {
            bytes += chunk.length;
            hash.update(chunk);
            yield chunk;
          }
        })(),
      );
      await pipeline(
        checkedContent,
        createWriteStream(absolute, { flags: 'wx', mode: entry.mode & 0o7777 }),
      );
      const digest = hash.digest('hex');
      if (bytes !== entry.bytes || !entry.sha256 || digest !== entry.sha256.toLowerCase()) {
        throw new RpcError(
          `Backup file integrity check failed: ${relative}`,
          RpcErrorCode.BackupArchiveCorrupt,
        );
      }
      applyFileMetadata(absolute, entry.mode, entry.mtime);
    },
  });

  if (seen.size !== manifest.entries.length) {
    throw new RpcError(
      'Backup manifest entry count does not match the archive.',
      RpcErrorCode.BackupArchiveCorrupt,
    );
  }
  const manifestEntries = new Map(manifest.entries.map((entry) => [entry.path, entry]));
  for (const [relative, archived] of seen) {
    const expected = manifestEntries.get(relative);
    if (
      !expected ||
      expected.kind !== archived.kind ||
      expected.bytes !== archived.bytes ||
      expected.sha256 !== (archived.sha256 ?? null) ||
      expected.mtime !== archived.mtime ||
      expected.mode !== archived.mode ||
      (expected.linkTarget ?? null) !== (archived.linkTarget ?? null)
    ) {
      throw new RpcError(
        `Backup manifest does not match entry ${relative}.`,
        RpcErrorCode.BackupArchiveCorrupt,
      );
    }
  }
  for (const directory of directoryPaths.reverse()) {
    if (existsSync(directory.path))
      applyFileMetadata(directory.path, directory.mode, directory.mtime);
  }
  return { manifest, warnings };
}

export function ensureRestoreTargetIsEmpty(targetPath: string): string {
  if (!path.isAbsolute(targetPath)) {
    throw new RpcError('Restore target path must be absolute.', RpcErrorCode.InvalidParams);
  }
  const absolute = path.resolve(targetPath);
  if (!existsSync(absolute)) return absolute;
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch {
    return absolute;
  }
  if (!stat.isDirectory()) {
    throw new RpcError(
      'Restore target must not exist or must be an empty directory.',
      RpcErrorCode.BackupTargetNotEmpty,
    );
  }
  if (readdirSync(absolute).length > 0) {
    throw new RpcError('Restore target directory is not empty.', RpcErrorCode.BackupTargetNotEmpty);
  }
  return absolute;
}

export function restoreStagingPath(targetPath: string, suffix: string): string {
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.gcbackup-${suffix}`);
}

export function removeRestoreStaging(targetPath: string): void {
  rmSync(targetPath, { recursive: true, force: true });
}

function validateRelativePath(value: string): string {
  if (!value || value.includes('\\') || value.startsWith('/') || path.posix.isAbsolute(value)) {
    throw new RpcError('Backup entry path is not relative.', RpcErrorCode.BackupArchiveCorrupt);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new RpcError(
      'Backup entry path contains an unsafe segment.',
      RpcErrorCode.BackupArchiveCorrupt,
    );
  }
  return segments.join('/');
}

function resolveInside(root: string, relative: string): string {
  const absolute = path.resolve(root, ...relative.split('/'));
  const fromRoot = path.relative(root, absolute);
  if (
    fromRoot === '' ||
    fromRoot.startsWith(`..${path.sep}`) ||
    fromRoot === '..' ||
    path.isAbsolute(fromRoot)
  ) {
    throw new RpcError(
      'Backup entry path escapes the restore target.',
      RpcErrorCode.BackupArchiveCorrupt,
    );
  }
  return absolute;
}

function hasSymlinkParent(relative: string, symlinks: Set<string>): boolean {
  const segments = relative.split('/');
  for (let index = 1; index < segments.length; index += 1) {
    if (symlinks.has(segments.slice(0, index).join('/'))) return true;
  }
  return false;
}

function isLinkInsideTarget(root: string, linkPath: string, target: string): boolean {
  if (path.isAbsolute(target) || target.includes('\\')) return false;
  const resolved = path.resolve(path.dirname(linkPath), target);
  const relative = path.relative(root, resolved);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function applyFileMetadata(filePath: string, mode: number, mtime: string): void {
  if (process.platform !== 'win32') chmodSync(filePath, mode & 0o7777);
  const date = new Date(mtime);
  if (!Number.isNaN(date.getTime())) utimesSync(filePath, date, date);
}

async function drain(content: AsyncIterable<Buffer>): Promise<void> {
  for await (const chunk of content) {
    void chunk;
  }
}
