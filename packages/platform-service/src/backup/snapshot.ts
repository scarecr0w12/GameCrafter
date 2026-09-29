import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createReadStream,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
} from 'node:fs';
import path from 'node:path';
import type { BackupManifest, BackupManifestEntry, BackupScope } from '@gamecrafter/contracts';
import type { BackupArchiveWriteEntry } from './archive/types';

export interface BackupSnapshotOptions {
  archiveId: string;
  scope: BackupScope;
  projectId: string | null;
  sourcePath: string;
  snapshotPath: string;
  databaseSnapshotPath: string;
  snapshotDatabase(destinationPath: string): void;
  createdAt: string;
  platformVersion: string;
  profileSchemaVersion: number;
  projectSchemaVersion: number;
  pluginVersions: Record<string, string>;
  excludeGlobs: string[];
  includeAssetJobs: boolean;
}

export interface BackupSnapshot {
  manifest: BackupManifest;
  entries: BackupArchiveWriteEntry[];
}

export async function createBackupSnapshot(
  options: BackupSnapshotOptions,
): Promise<BackupSnapshot> {
  const sourceRoot = path.resolve(options.sourcePath);
  const snapshotRoot = path.resolve(options.snapshotPath);
  const databaseRelative = normalizeRelative(options.databaseSnapshotPath);
  mkdirSync(snapshotRoot, { recursive: true, mode: 0o700 });
  const databasePath = path.join(snapshotRoot, ...databaseRelative.split('/'));
  mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
  options.snapshotDatabase(databasePath);

  const excluded: string[] = [];
  const manifestEntries: BackupManifestEntry[] = [];
  const archiveEntries: BackupArchiveWriteEntry[] = [];
  const configuredGlobs = options.excludeGlobs.map(normalizePattern).filter(Boolean);

  const visit = async (relative: string): Promise<void> => {
    const posixRelative = normalizeRelative(relative);
    const source = path.join(sourceRoot, ...posixRelative.split('/'));
    const isDatabaseSnapshot = posixRelative === databaseRelative;
    const sourceStat = lstatSync(source);
    const excludedReason = isDatabaseSnapshot
      ? undefined
      : exclusionReason(
          options.scope,
          posixRelative,
          sourceStat.isDirectory(),
          options.includeAssetJobs,
          configuredGlobs,
        );
    if (excludedReason) {
      excluded.push(excludedReason);
      return;
    }

    if (sourceStat.isSymbolicLink()) {
      const entry: BackupManifestEntry = {
        path: posixRelative,
        kind: 'symlink',
        bytes: 0,
        mode: sourceStat.mode & 0o7777,
        mtime: sourceStat.mtime.toISOString(),
        sha256: null,
        linkTarget: readlinkSync(source),
      };
      manifestEntries.push(entry);
      archiveEntries.push(entry);
      return;
    }

    const snapshot = path.join(snapshotRoot, ...posixRelative.split('/'));
    if (sourceStat.isDirectory()) {
      mkdirSync(snapshot, { recursive: true, mode: sourceStat.mode & 0o7777 });
      const entry: BackupManifestEntry = {
        path: posixRelative,
        kind: 'dir',
        bytes: 0,
        mode: sourceStat.mode & 0o7777,
        mtime: sourceStat.mtime.toISOString(),
        sha256: null,
      };
      manifestEntries.push(entry);
      archiveEntries.push(entry);
      const children = readdirSync(source).sort((left, right) => left.localeCompare(right));
      for (const child of children) await visit(`${posixRelative}/${child}`);
      return;
    }

    if (!sourceStat.isFile()) return;
    if (!isDatabaseSnapshot) {
      mkdirSync(path.dirname(snapshot), { recursive: true, mode: 0o700 });
      copyFileSync(source, snapshot);
    }
    const stagedStat = lstatSync(snapshot);
    const sha256 = await hashFile(snapshot);
    const entry: BackupManifestEntry = {
      path: posixRelative,
      kind: 'file',
      bytes: stagedStat.size,
      mode: sourceStat.mode & 0o7777,
      mtime: sourceStat.mtime.toISOString(),
      sha256,
    };
    manifestEntries.push(entry);
    archiveEntries.push({ ...entry, content: createReadStream(snapshot) });
  };

  for (const child of readdirSync(sourceRoot).sort((left, right) => left.localeCompare(right))) {
    await visit(child);
  }
  if (!manifestEntries.some((entry) => entry.path === databaseRelative)) {
    const stat = lstatSync(databasePath);
    const entry: BackupManifestEntry = {
      path: databaseRelative,
      kind: 'file',
      bytes: stat.size,
      mode: stat.mode & 0o7777,
      mtime: stat.mtime.toISOString(),
      sha256: await hashFile(databasePath),
    };
    manifestEntries.push(entry);
    archiveEntries.push({ ...entry, content: createReadStream(databasePath) });
  }
  manifestEntries.sort((left, right) => left.path.localeCompare(right.path));
  archiveEntries.sort((left, right) => left.path.localeCompare(right.path));
  const manifest: BackupManifest = {
    schemaVersion: 1,
    archiveId: options.archiveId,
    scope: options.scope,
    projectId: options.projectId,
    createdAt: options.createdAt,
    platformVersion: options.platformVersion,
    schemaVersions: {
      profile: options.profileSchemaVersion,
      project: options.projectSchemaVersion,
    },
    pluginVersions: options.pluginVersions,
    entries: manifestEntries,
    excluded: [...new Set(excluded)].sort(),
    notes:
      options.scope === 'project'
        ? ['Git internals are captured as files at a point in time.']
        : [
            'Profile restore extracts files only; point GAMECRAFTER_PROFILE_DIR at the restored folder.',
          ],
  };
  return { manifest, entries: archiveEntries };
}

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

export function exclusionReason(
  scope: BackupScope,
  relative: string,
  isDirectory: boolean,
  includeAssetJobs: boolean,
  globs: string[],
): string | undefined {
  const segments = relative.split('/');
  const basename = segments.at(-1) ?? '';
  if (scope === 'profile') {
    if (segments.some((segment) => segment === 'cache')) return relative;
    if (segments[0] === 'run' || segments[0] === 'logs') return relative;
    if (basename === 'service.token' || basename === 'service.lock') return relative;
    if (/\.sqlite-(?:wal|shm|journal)$/.test(basename) || /\.sqlite-.+$/.test(basename))
      return relative;
  } else {
    if (
      relative === '.gamecrafter/cache' ||
      relative.startsWith('.gamecrafter/cache/') ||
      relative === '.gamecrafter/logs' ||
      relative.startsWith('.gamecrafter/logs/') ||
      relative === '.gamecrafter/run' ||
      relative.startsWith('.gamecrafter/run/')
    ) {
      return relative;
    }
    if (
      !includeAssetJobs &&
      (relative === '.gamecrafter/asset-jobs' || relative.startsWith('.gamecrafter/asset-jobs/'))
    ) {
      return relative;
    }
    if (/\.sqlite-(?:wal|shm|journal)$/.test(basename)) return relative;
  }
  const match = globs.find(
    (glob) => globMatches(glob, relative) || (isDirectory && globMatches(glob, `${relative}/`)),
  );
  return match ? `glob:${match}` : undefined;
}

function normalizeRelative(value: string): string {
  return value
    .split(path.sep)
    .join('/')
    .replace(/^\/+|\/+$/g, '');
}

function normalizePattern(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function globMatches(pattern: string, value: string): boolean {
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    if (character === '*' && pattern[index + 1] === '*') {
      index += 1;
      if (pattern[index + 1] === '/') {
        index += 1;
        expression += '(?:.*/)?';
      } else {
        expression += '.*';
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  expression += '$';
  return new RegExp(expression).test(value);
}
