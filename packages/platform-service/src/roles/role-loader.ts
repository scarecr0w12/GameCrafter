import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  compile,
  RpcError,
  RpcErrorCode,
  ValidationError,
  RoleFrontmatterSchema,
  type RoleFrontmatter,
  type RoleRecord,
} from '@gamecrafter/contracts';
import { parseDocument } from 'yaml';

const validator = compile<RoleFrontmatter>(RoleFrontmatterSchema);

export function loadRoleDir(
  directory: string,
  scope: RoleRecord['scope'],
  source: 'builtin' | 'platform' | 'project' | 'plugin' = scope,
): RoleRecord {
  const absoluteDirectory = path.resolve(directory);
  const roleFile = path.join(absoluteDirectory, 'ROLE.md');
  let markdown: string;
  try {
    markdown = readFileSync(roleFile, 'utf8');
  } catch {
    throw roleInvalid(absoluteDirectory, ['Missing ROLE.md.']);
  }
  const { frontmatter, body } = parseRoleMarkdown(markdown, absoluteDirectory);
  let role: RoleFrontmatter;
  try {
    role = validator.assert(frontmatter);
  } catch (error) {
    const errors = error instanceof ValidationError ? error.errors : [errorMessage(error)];
    throw roleInvalid(absoluteDirectory, errors);
  }
  const directoryName = path.basename(absoluteDirectory);
  if (role.name !== directoryName) {
    throw roleInvalid(absoluteDirectory, [
      `Role name "${role.name}" does not match directory name "${directoryName}".`,
    ]);
  }
  if (source === 'plugin' && role['max-access'] === 'full') {
    throw roleInvalid(absoluteDirectory, ['Plugin roles cannot set max-access: full.']);
  }
  if (source === 'plugin' && role['mcp-servers'] !== undefined) {
    throw roleInvalid(absoluteDirectory, ['Plugin roles cannot declare inline mcp-servers.']);
  }
  const files = collectRoleFiles(absoluteDirectory);
  return {
    name: role.name,
    description: role.description,
    workTypes: splitList(role['work-types']),
    requiresModules: splitList(role['requires-modules']),
    modelPool: role['model-pool'] ?? null,
    maxAccess: role['max-access'],
    tools: splitList(role.tools),
    disallowedTools: splitList(role['disallowed-tools']),
    skills: splitList(role.skills),
    mcpServers: role['mcp-servers'] ?? [],
    maxTurns: role['max-turns'] ?? null,
    memory: role.memory ?? 'none',
    boardSubscriptions: splitList(role['board-subscriptions']),
    isolation: role.isolation ?? 'none',
    locks: splitList(role.locks),
    location: realpathSync(absoluteDirectory),
    scope,
    systemPrompt: body,
    hash: hashFiles(absoluteDirectory, files),
  };
}

function parseRoleMarkdown(
  markdown: string,
  location: string,
): { frontmatter: unknown; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);
  if (lines[0]?.trim() !== '---')
    throw roleInvalid(location, ['ROLE.md is missing YAML frontmatter.']);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex < 0) throw roleInvalid(location, ['ROLE.md has unterminated YAML frontmatter.']);
  const document = parseDocument(lines.slice(1, closingIndex).join('\n'), { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw roleInvalid(
      location,
      document.errors.map((error) => error.message),
    );
  }
  const frontmatter: unknown = document.toJS();
  if (typeof frontmatter !== 'object' || frontmatter === null || Array.isArray(frontmatter)) {
    throw roleInvalid(location, ['Role frontmatter must be a YAML mapping.']);
  }
  return { frontmatter, body: lines.slice(closingIndex + 1).join('\n') };
}

function collectRoleFiles(directory: string, relativeDirectory = ''): string[] {
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
    if (entry.isDirectory()) files.push(...collectRoleFiles(directory, relative));
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

function splitList(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function roleInvalid(directory: string, errors: string[]): RpcError {
  return new RpcError(
    `Invalid role at ${directory}: ${errors.join('; ')}`,
    RpcErrorCode.RoleInvalid,
    { errors },
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
