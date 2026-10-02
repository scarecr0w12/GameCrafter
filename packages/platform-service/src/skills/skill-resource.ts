import { closeSync, constants, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  type SkillRecord,
  type SkillResourceReadParams,
  type SkillResourceReadResult,
} from '@gamecrafter/contracts';

const maxResourceBytes = 256 * 1024;
const maxResponseBytes = 64 * 1024;

/** Read only inventoried UTF-8 files, retaining containment after symlink resolution. */
export function readSkillResource(
  skill: SkillRecord,
  request: Pick<SkillResourceReadParams, 'resource' | 'startLine' | 'maxLines'>,
): SkillResourceReadResult {
  const { resource } = request;
  const startLine = request.startLine ?? 1;
  const maxLines = request.maxLines ?? 200;
  const invalid = (message: string): never => {
    throw new RpcError(message, RpcErrorCode.SkillInvalid);
  };
  if (
    !Number.isSafeInteger(startLine) ||
    startLine < 1 ||
    !Number.isSafeInteger(maxLines) ||
    maxLines < 1 ||
    maxLines > 500
  ) {
    invalid('Skill resource reads require startLine >= 1 and maxLines between 1 and 500.');
  }
  if (resource !== 'SKILL.md' && !skill.resources.includes(resource)) {
    invalid('The requested file is not an inventoried skill resource.');
  }
  if (
    resource.includes('\\') ||
    resource.includes('\0') ||
    resource.includes(':') ||
    path.posix.isAbsolute(resource) ||
    resource.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')
  ) {
    invalid('Skill resource paths must be relative and cannot contain traversal segments.');
  }
  const root = realpathSync(skill.location);
  const filename = path.join(root, resource);
  const resolved = realpathSync(filename);
  const relative = path.relative(root, resolved);
  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative) ||
    lstatSync(filename).isSymbolicLink() ||
    !lstatSync(filename).isFile()
  ) {
    invalid('Skill resources must be regular files inside their skill directory.');
  }
  // A bounded allocation also protects against files growing between inventory and read.
  const buffer = Buffer.alloc(maxResourceBytes + 1);
  const descriptor = openSync(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let bytes = 0;
  try {
    while (bytes < buffer.length) {
      const count = readSync(descriptor, buffer, bytes, buffer.length - bytes, null);
      if (count === 0) break;
      bytes += count;
    }
  } finally {
    closeSync(descriptor);
  }
  if (bytes > maxResourceBytes) invalid('Skill text resources must be at most 256 KiB.');
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes));
  } catch {
    return invalid('This resource is not UTF-8 text.');
  }
  if (content.includes('\0')) invalid('Binary skill resources cannot be read as text.');
  const lines = content.length === 0 ? [] : content.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (startLine > lines.length + 1) invalid('startLine is beyond the end of this resource.');
  const selected: string[] = [];
  let characters = 0;
  for (const line of lines.slice(startLine - 1, startLine - 1 + maxLines)) {
    const lineBytes = Buffer.byteLength(line, 'utf8');
    if (lineBytes > maxResponseBytes) invalid('A resource line exceeds the 64 KiB response limit.');
    const addedBytes = lineBytes + (selected.length === 0 ? 0 : 1);
    if (characters + addedBytes > maxResponseBytes) break;
    selected.push(line);
    characters += addedBytes;
  }
  const endLine = startLine + selected.length - 1;
  return {
    schemaVersion: 1,
    name: skill.name,
    resource,
    hash: skill.hash,
    content: selected.join('\n'),
    startLine,
    endLine,
    totalLines: lines.length,
    truncated: endLine < lines.length,
  };
}
