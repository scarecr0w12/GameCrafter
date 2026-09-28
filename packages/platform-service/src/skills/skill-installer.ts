import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { x as extractTar } from 'tar';
import {
  RpcError,
  RpcErrorCode,
  type SkillPlatformMetadata,
  type SkillRecord,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { SettingsService } from '../settings/settings-service';
import { loadSkillDir, type SkillLoadOptions } from './skill-loader';
import { resolveSource, type SkillSource } from './skill-sources';

const execFileAsync = promisify(execFile);
type SettingsReader = Pick<SettingsService, 'resolve'>;

export interface InstalledSkillRow {
  name: string;
  source: string;
  resolvedRef: string | null;
  version: string | null;
  hash: string;
  previousHash: string | null;
  license: string | null;
  compatibility: string | null;
  description: string;
  metadata: SkillPlatformMetadata;
  installedAt: string;
  updatedAt: string;
}

export class SkillInstaller {
  constructor(
    private readonly database: Database,
    private readonly profileDir: string,
    private readonly settings: SettingsReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get skillsDirectory(): string {
    return this.profileSkillsDir();
  }

  async install(sourceText: string, name?: string, force = false): Promise<SkillRecord[]> {
    const source = resolveSource(sourceText);
    if (source.kind === 'skills-sh-pack') {
      throw new RpcError(
        'skills.sh packs require the optional proxy plugin',
        RpcErrorCode.SkillSourceUnsupported,
      );
    }
    const stagingRoot = mkdtempSync(path.join(tmpdir(), 'gc-skill-source-'));
    try {
      const prepared = await this.prepareSource(source, stagingRoot);
      const candidates = locateSkillDirectories(prepared.root, prepared.subpath);
      if (candidates.length === 0) {
        throw new RpcError(
          'No SKILL.md directories were found in the source.',
          RpcErrorCode.SkillInvalid,
        );
      }
      const records = candidates.map((candidate) =>
        loadSkillDir(candidate, 'platform', sourceText, {
          resolvedRef: prepared.resolvedRef,
        }),
      );
      if (name && !records.some((record) => record.name === name)) {
        throw new RpcError(`Skill not found in source: ${name}`, RpcErrorCode.SkillNotFound);
      }
      if (!name && records.length > 1) {
        const names = records.map((record) => record.name).sort();
        throw new RpcError(
          `Source contains multiple skills (${names.join(', ')}); specify a name.`,
          RpcErrorCode.SkillInvalid,
          { names },
        );
      }
      const selected = name ? records.filter((record) => record.name === name) : records;
      const installed: SkillRecord[] = [];
      for (const record of selected) {
        installed.push(await this.installRecord(record, sourceText, prepared.resolvedRef, force));
      }
      return installed;
    } finally {
      rmSync(stagingRoot, { recursive: true, force: true });
    }
  }

  uninstall(name: string): void {
    if (!this.getInstalled(name)) {
      throw new RpcError(`Skill not found: ${name}`, RpcErrorCode.SkillNotFound);
    }
    rmSync(path.join(this.profileSkillsDir(), name), { recursive: true, force: true });
    this.database.prepare('DELETE FROM installed_skills WHERE name = ?').run(name);
  }

  listInstalled(): InstalledSkillRow[] {
    return this.database
      .prepare(
        `SELECT name, source, resolved_ref AS resolvedRef, version, hash,
          previous_hash AS previousHash, license, compatibility, description,
          metadata, installed_at AS installedAt, updated_at AS updatedAt
         FROM installed_skills ORDER BY name`,
      )
      .all<InstalledSkillDatabaseRow>()
      .map((row) => ({ ...row, metadata: JSON.parse(row.metadata) as SkillPlatformMetadata }));
  }

  listInstalledRecords(): SkillRecord[] {
    return this.listInstalled().flatMap((installed) => {
      const directory = path.join(this.profileSkillsDir(), installed.name);
      if (!existsSync(directory)) return [];
      try {
        const loaded = loadSkillDir(directory, 'platform', installed.source, {
          resolvedRef: installed.resolvedRef,
          installedAt: installed.installedAt,
        });
        return [
          {
            ...loaded,
            description: installed.description,
            hash: installed.hash,
            version: installed.version,
            license: installed.license,
            compatibility: installed.compatibility,
            platform: installed.metadata,
          },
        ];
      } catch {
        return [];
      }
    });
  }

  getInstalled(name: string): InstalledSkillRow | undefined {
    const row = this.database
      .prepare(
        `SELECT name, source, resolved_ref AS resolvedRef, version, hash,
          previous_hash AS previousHash, license, compatibility, description,
          metadata, installed_at AS installedAt, updated_at AS updatedAt
         FROM installed_skills WHERE name = ?`,
      )
      .get<InstalledSkillDatabaseRow>(name);
    return row
      ? { ...row, metadata: JSON.parse(row.metadata) as SkillPlatformMetadata }
      : undefined;
  }

  private async prepareSource(
    source: SkillSource,
    stagingRoot: string,
  ): Promise<{ root: string; subpath?: string; resolvedRef: string | null }> {
    if (source.kind === 'local') {
      if (!existsSync(source.path)) {
        throw new RpcError(
          `Local skill source does not exist: ${source.path}`,
          RpcErrorCode.SkillInvalid,
        );
      }
      const stats = statSync(source.path);
      if (!stats.isDirectory() && path.basename(source.path) !== 'SKILL.md') {
        throw new RpcError(
          `Local skill source is not a directory or SKILL.md: ${source.path}`,
          RpcErrorCode.SkillInvalid,
        );
      }
      return {
        root: stats.isDirectory() ? source.path : path.dirname(source.path),
        resolvedRef: null,
      };
    }
    if (source.kind === 'git') {
      const checkout = path.join(stagingRoot, gitDirectoryName(source.url));
      const args = ['clone', '--depth', '1'];
      if (source.ref) args.push('--branch', source.ref);
      args.push(source.url, checkout);
      try {
        await execFileAsync('git', args, { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
        const { stdout } = await execFileAsync('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
          timeout: 15_000,
          maxBuffer: 1024 * 1024,
        });
        return { root: checkout, subpath: source.subpath, resolvedRef: stdout.trim() };
      } catch (error) {
        throw new RpcError(
          `Unable to clone skill source: ${errorMessage(error)}`,
          RpcErrorCode.SkillInvalid,
        );
      }
    }
    if (source.kind === 'archive-url') {
      const archive = path.join(stagingRoot, 'skill-archive.tgz');
      await downloadToFile(source.url, archive, this.archiveLimitBytes());
      const extracted = path.join(stagingRoot, 'extracted');
      mkdirSync(extracted);
      await extractArchive(archive, extracted, this.extractedLimitBytes(), this.maxFiles());
      return { root: extracted, resolvedRef: null };
    }
    if (source.kind === 'skill-md-url') {
      const bytes = await downloadBytes(source.url, this.archiveLimitBytes());
      const skillName = nameFromSkillUrl(source.url);
      const directory = path.join(stagingRoot, skillName);
      mkdirSync(directory);
      writeFileSync(path.join(directory, 'SKILL.md'), bytes);
      return { root: directory, resolvedRef: null };
    }
    throw new RpcError('Unsupported skill source.', RpcErrorCode.SkillSourceUnsupported);
  }

  private async installRecord(
    sourceRecord: SkillRecord,
    source: string,
    resolvedRef: string | null,
    force: boolean,
  ): Promise<SkillRecord> {
    const previous = this.getInstalled(sourceRecord.name);
    const destination = path.join(this.profileSkillsDir(), sourceRecord.name);
    if (previous && !force) {
      throw new RpcError(
        `Skill already installed: ${sourceRecord.name}`,
        RpcErrorCode.SkillAlreadyInstalled,
      );
    }
    if (existsSync(destination) && !previous && !force) {
      throw new RpcError(
        `Skill already installed: ${sourceRecord.name}`,
        RpcErrorCode.SkillAlreadyInstalled,
      );
    }

    const skillsDir = this.profileSkillsDir();
    mkdirSync(skillsDir, { recursive: true, mode: 0o700 });
    const stageDirectory = mkdtempSync(path.join(skillsDir, `.${sourceRecord.name}-stage-`));
    const stagedSkill = path.join(stageDirectory, sourceRecord.name);
    const backup = path.join(stageDirectory, 'previous');
    let movedPrevious = false;
    const installedAt = this.now().toISOString();
    const loadOptions: SkillLoadOptions = { resolvedRef, installedAt };
    try {
      copySkillDirectory(sourceRecord.location, stagedSkill);
      loadSkillDir(stagedSkill, 'platform', source, loadOptions);
      if (existsSync(destination)) {
        renameSync(destination, backup);
        movedPrevious = true;
      }
      renameSync(stagedSkill, destination);
      const installedRecord = loadSkillDir(destination, 'platform', source, loadOptions);
      this.writeInstalled(installedRecord, previous?.hash ?? null, installedAt);
      rmSync(backup, { recursive: true, force: true });
      return installedRecord;
    } catch (error) {
      if (existsSync(destination) && movedPrevious)
        rmSync(destination, { recursive: true, force: true });
      if (movedPrevious && existsSync(backup)) renameSync(backup, destination);
      throw error;
    } finally {
      rmSync(stageDirectory, { recursive: true, force: true });
    }
  }

  private profileSkillsDir(): string {
    return path.join(this.profileDir, 'skills');
  }

  private archiveLimitBytes(): number {
    return settingMiB(this.settings, 'skills.installLimits.archiveMiB');
  }

  private extractedLimitBytes(): number {
    return settingMiB(this.settings, 'skills.installLimits.extractedMiB');
  }

  private maxFiles(): number {
    const value = Number(this.settings.resolve('skills.installLimits.maxFiles').value);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 1000;
  }

  private writeInstalled(
    record: SkillRecord,
    previousHash: string | null,
    installedAt: string,
  ): void {
    this.database
      .prepare(
        `INSERT INTO installed_skills (
          name, source, resolved_ref, version, hash, previous_hash, license,
          compatibility, description, metadata, installed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          source = excluded.source,
          resolved_ref = excluded.resolved_ref,
          version = excluded.version,
          hash = excluded.hash,
          previous_hash = excluded.previous_hash,
          license = excluded.license,
          compatibility = excluded.compatibility,
          description = excluded.description,
          metadata = excluded.metadata,
          installed_at = excluded.installed_at,
          updated_at = excluded.updated_at`,
      )
      .run(
        record.name,
        record.source,
        record.resolvedRef,
        record.version,
        record.hash,
        previousHash,
        record.license,
        record.compatibility,
        record.description,
        JSON.stringify(record.platform),
        installedAt,
        installedAt,
      );
  }
}

interface InstalledSkillDatabaseRow extends Omit<InstalledSkillRow, 'metadata'> {
  metadata: string;
}

async function downloadToFile(url: string, destination: string, maxBytes: number): Promise<void> {
  const bytes = await downloadBytes(url, maxBytes);
  writeFileSync(destination, bytes);
}

async function downloadBytes(url: string, maxBytes: number): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new RpcError(
      `Unable to fetch skill source: ${errorMessage(error)}`,
      RpcErrorCode.SkillInvalid,
    );
  }
  if (!response.ok) {
    throw new RpcError(`Skill source returned HTTP ${response.status}.`, RpcErrorCode.SkillInvalid);
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw tooLarge(`Skill archive exceeds the ${maxBytes} byte download limit.`);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw tooLarge('Skill source exceeds the download limit.');
    return bytes;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw tooLarge('Skill source exceeds the download limit.');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function extractArchive(
  archivePath: string,
  destination: string,
  maxExtractedBytes: number,
  maxFiles: number,
): Promise<void> {
  let extractedBytes = 0;
  let extractedFiles = 0;
  let guardError: RpcError | undefined;
  try {
    await extractTar({
      file: archivePath,
      cwd: destination,
      strict: true,
      preservePaths: false,
      filter: (archiveEntryPath, entry) => {
        const normalizedPath = archiveEntryPath.replace(/\\/g, '/');
        if (path.isAbsolute(archiveEntryPath) || normalizedPath.split('/').includes('..')) {
          guardError = new RpcError(
            'Skill archive contains an unsafe path or link.',
            RpcErrorCode.SkillInvalid,
          );
          return false;
        }
        if ('type' in entry) {
          if (entry.type === 'SymbolicLink' || entry.type === 'Link') {
            guardError = new RpcError(
              'Skill archive contains an unsafe path or link.',
              RpcErrorCode.SkillInvalid,
            );
            return false;
          }
          if (entry.type !== 'Directory' && !entry.meta) {
            extractedFiles += 1;
            extractedBytes += entry.size;
          }
        } else {
          if (entry.isSymbolicLink()) {
            guardError = new RpcError(
              'Skill archive contains an unsafe path or link.',
              RpcErrorCode.SkillInvalid,
            );
            return false;
          }
          if (!entry.isDirectory()) {
            extractedFiles += 1;
            extractedBytes += entry.size;
          }
        }
        if (extractedFiles > maxFiles)
          guardError = tooLarge('Skill archive exceeds the extracted file-count limit.');
        if (extractedBytes > maxExtractedBytes)
          guardError = tooLarge('Skill archive exceeds the extracted size limit.');
        if (guardError) return false;
        return true;
      },
    });
  } catch (error) {
    if (guardError) throw guardError;
    throw new RpcError(
      `Unable to extract skill archive: ${errorMessage(error)}`,
      RpcErrorCode.SkillInvalid,
    );
  }
  if (guardError) throw guardError;
  const actual = measureDirectory(destination);
  if (actual.files > maxFiles || actual.bytes > maxExtractedBytes) {
    throw tooLarge('Skill archive exceeds the extracted size or file-count limit.');
  }
}

function measureDirectory(directory: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const stats = lstatSync(fullPath);
      if (stats.isSymbolicLink())
        throw new RpcError('Skill archive extracted a symbolic link.', RpcErrorCode.SkillInvalid);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) {
        files += 1;
        bytes += stats.size;
      }
    }
  };
  visit(directory);
  return { files, bytes };
}

function locateSkillDirectories(root: string, subpath?: string): string[] {
  const absoluteRoot = path.resolve(root);
  const base = subpath ? path.resolve(absoluteRoot, subpath) : absoluteRoot;
  if (!isWithin(absoluteRoot, base) || !existsSync(base)) {
    throw new RpcError(
      'Requested skill subpath does not exist in the source.',
      RpcErrorCode.SkillInvalid,
    );
  }
  const start = statSync(base).isDirectory() ? base : path.dirname(base);
  if (path.basename(base) === 'SKILL.md' || existsSync(path.join(start, 'SKILL.md')))
    return [start];

  const preferredRoots = [path.join(start, 'skills'), path.join(start, '.agents', 'skills')];
  for (const preferredRoot of preferredRoots) {
    const candidates = directSkillDirectories(preferredRoot);
    if (candidates.length > 0) return candidates;
  }
  return scanForSkills(start, 5);
}

function directSkillDirectories(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => path.join(directory, entry.name))
    .filter((candidate) => existsSync(path.join(candidate, 'SKILL.md')))
    .sort();
}

function scanForSkills(directory: string, remainingDepth: number): string[] {
  if (existsSync(path.join(directory, 'SKILL.md'))) return [directory];
  if (remainingDepth <= 0) return [];
  const skills: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      entry.name === '.git' ||
      entry.name === 'node_modules'
    )
      continue;
    skills.push(...scanForSkills(path.join(directory, entry.name), remainingDepth - 1));
  }
  return skills.sort();
}

function copySkillDirectory(source: string, destination: string): void {
  cpSync(source, destination, {
    recursive: true,
    filter: (sourcePath) => {
      const relative = path.relative(source, sourcePath).split(path.sep).join('/');
      if (relative === '.git' || relative.startsWith('.git/')) return false;
      try {
        return !lstatSync(sourcePath).isSymbolicLink();
      } catch {
        return false;
      }
    },
  });
}

function gitDirectoryName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).replace(/\.git$/i, '') || 'repository';
  } catch {
    return (
      url
        .split(':')
        .pop()
        ?.split('/')
        .pop()
        ?.replace(/\.git$/i, '') || 'repository'
    );
  }
}

function nameFromSkillUrl(url: string): string {
  const parent = path.basename(path.dirname(new URL(url).pathname));
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(parent) ? parent : 'downloaded-skill';
}

function settingMiB(settings: SettingsReader, key: string): number {
  const value = Number(settings.resolve(key).value);
  const fallback = key.endsWith('extractedMiB') ? 25 : 10;
  const mebibytes = Number.isFinite(value) ? Math.max(0, value) : fallback;
  return Math.floor(mebibytes * 1024 * 1024);
}

function tooLarge(message: string): RpcError {
  return new RpcError(message, RpcErrorCode.SkillTooLarge);
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
