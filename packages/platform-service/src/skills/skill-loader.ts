import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  compile,
  RpcError,
  RpcErrorCode,
  SkillFrontmatterSchema,
  ValidationError,
  type SkillFrontmatter,
  type SkillPlatformMetadata,
  type SkillRecord,
} from '@gamecrafter/contracts';
import { parseDocument } from 'yaml';

export interface SkillLoadOptions {
  resolvedRef?: string | null;
  installedAt?: string | null;
}

const frontmatterValidator = compile<SkillFrontmatter>(SkillFrontmatterSchema);
const frontmatterKeys = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'allowed-tools',
  'metadata',
]);
const platformMetadata = new Map<keyof SkillPlatformMetadata, string>([
  ['version', 'gamecrafter-version'],
  ['engines', 'gamecrafter-engines'],
  ['genres', 'gamecrafter-genres'],
  ['workTypes', 'gamecrafter-work-types'],
  ['roles', 'gamecrafter-roles'],
  ['capabilities', 'gamecrafter-capabilities'],
  ['minPlatform', 'gamecrafter-min-platform'],
]);
const recognizedPlatformKeys = new Set(platformMetadata.values());

export function loadSkillDir(
  directory: string,
  scope: SkillRecord['scope'],
  source = directory,
  options: SkillLoadOptions = {},
): SkillRecord {
  const errors: string[] = [];
  const warnings: string[] = [];
  const absoluteDirectory = path.resolve(directory);
  const skillFile = path.join(absoluteDirectory, 'SKILL.md');
  let markdown: string;
  try {
    markdown = readFileSync(skillFile, 'utf8');
  } catch {
    throw skillInvalid(absoluteDirectory, ['Missing SKILL.md.']);
  }

  const parsed = parseSkillMarkdown(markdown, absoluteDirectory);
  errors.push(...parsed.errors);
  warnings.push(...parsed.warnings);
  if (!parsed.frontmatter) throw skillInvalid(absoluteDirectory, errors);

  let frontmatter;
  try {
    frontmatter = frontmatterValidator.assert(parsed.frontmatter);
  } catch (error) {
    if (error instanceof ValidationError) errors.push(...error.errors);
    else errors.push(error instanceof Error ? error.message : String(error));
    throw skillInvalid(absoluteDirectory, errors);
  }

  const directoryName = path.basename(absoluteDirectory);
  if (frontmatter.name !== directoryName) {
    errors.push(
      `Skill name "${frontmatter.name}" does not match directory name "${directoryName}".`,
    );
  }
  if (errors.length > 0) throw skillInvalid(absoluteDirectory, errors);

  for (const key of Object.keys(parsed.frontmatter)) {
    if (!frontmatterKeys.has(key)) warnings.push(`Unknown frontmatter key: ${key}`);
  }
  const metadata = frontmatter.metadata ?? {};
  for (const key of Object.keys(metadata)) {
    if (key.startsWith('gamecrafter-') && !recognizedPlatformKeys.has(key)) {
      warnings.push(`Unknown platform metadata key: ${key}`);
    }
  }
  if (bodyLineCount(parsed.body) > 500) warnings.push('Skill body exceeds 500 lines.');

  const platform = parsePlatformMetadata(metadata);
  const files = collectFiles(absoluteDirectory);
  const hash = hashFiles(absoluteDirectory, files);
  const resources = files
    .filter((relative) => /^(references|assets|scripts)\//.test(relative))
    .sort();
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    location: realpathSync(absoluteDirectory),
    scope,
    source,
    resolvedRef: options.resolvedRef ?? null,
    version: platform.version ?? null,
    hash,
    license: frontmatter.license ?? null,
    compatibility: frontmatter.compatibility ?? null,
    allowedTools: frontmatter['allowed-tools'] ?? null,
    platform,
    resources,
    installedAt: options.installedAt ?? null,
    warnings,
  };
}

export function stripFrontmatter(markdown: string): string {
  const parsed = parseSkillMarkdown(markdown, 'SKILL.md');
  return parsed.frontmatter ? parsed.body : markdown;
}

function parseSkillMarkdown(
  markdown: string,
  location: string,
): { frontmatter?: Record<string, unknown>; body: string; errors: string[]; warnings: string[] } {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { body: normalized, errors: [`${location} is missing YAML frontmatter.`], warnings: [] };
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex < 0) {
    return { body: '', errors: [`${location} has unterminated YAML frontmatter.`], warnings: [] };
  }
  const document = parseDocument(lines.slice(1, closingIndex).join('\n'), { uniqueKeys: true });
  const errors = document.errors.map((error) => error.message);
  const warnings = document.warnings.map((warning) => warning.message);
  let frontmatter: Record<string, unknown> | undefined;
  if (errors.length === 0) {
    const value: unknown = document.toJS();
    if (isRecord(value)) frontmatter = value;
    else errors.push('Skill frontmatter must be a YAML mapping.');
  }
  const body = lines.slice(closingIndex + 1).join('\n');
  return { frontmatter, body, errors, warnings };
}

function parsePlatformMetadata(metadata: Record<string, string>): SkillPlatformMetadata {
  const parsed: SkillPlatformMetadata = {};
  for (const [field, key] of platformMetadata) {
    const value = metadata[key];
    if (value === undefined) continue;
    if (field === 'version' || field === 'minPlatform') {
      (parsed as Record<string, unknown>)[field] = value;
    } else {
      (parsed as Record<string, unknown>)[field] = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return parsed;
}

function collectFiles(directory: string, relativeDirectory = ''): string[] {
  const files: string[] = [];
  const current = path.join(directory, relativeDirectory);
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (entry.name === '.git' && entry.isDirectory()) continue;
    const relative = relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name;
    const fullPath = path.join(directory, relative);
    const stats = lstatSync(fullPath);
    if (stats.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...collectFiles(directory, relative));
    else if (entry.isFile()) files.push(relative.split(path.sep).join('/'));
  }
  return files;
}

function hashFiles(directory: string, files: string[]): string {
  const hash = createHash('sha256');
  for (const relative of [...files].sort()) {
    hash.update(relative, 'utf8');
    hash.update('\0');
    hash.update(readFileSync(path.join(directory, relative)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function bodyLineCount(body: string): number {
  if (body.length === 0) return 0;
  const lines = body.split(/\r?\n/);
  return body.endsWith('\n') ? lines.length - 1 : lines.length;
}

function skillInvalid(directory: string, errors: string[]): RpcError {
  const allErrors = errors.length ? errors : ['Invalid skill.'];
  return new RpcError(
    `Invalid skill at ${directory}: ${allErrors.join('; ')}`,
    RpcErrorCode.SkillInvalid,
    { errors: allErrors },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
