import path from 'node:path';
import { stringify } from 'yaml';
import type { CanonRecordInput, CanonProvenance } from '@gamecrafter/contracts';

export interface CanonFileInput {
  record: CanonRecordInput;
  body: string;
  path?: string;
  provenance?: CanonProvenance[];
}

export class CanonStore {
  pathFor(input: CanonFileInput): string {
    const requested = input.path?.trim();
    const relative =
      requested || `docs/canon/${slug(input.record.type)}/${slug(input.record.id)}.md`;
    const normalized = path.posix.normalize(relative.replaceAll('\\', '/'));
    if (
      path.posix.isAbsolute(normalized) ||
      normalized === '..' ||
      normalized.startsWith('../') ||
      !normalized.startsWith('docs/canon/')
    ) {
      throw new Error('Canon record path must be inside docs/canon/.');
    }
    return normalized;
  }

  serialize(input: CanonFileInput): string {
    const record = input.record;
    const frontmatter = {
      schemaVersion: 1,
      id: record.id,
      type: record.type,
      title: record.title,
      status: record.status,
      ...(record.module ? { module: record.module } : {}),
      tags: record.tags ?? [],
      references: record.references ?? [],
      provenance: input.provenance ?? record.provenance ?? [],
      ...(record.supersedes ? { supersedes: record.supersedes } : {}),
    };
    const yaml = stringify(frontmatter, { lineWidth: 0 }).trimEnd();
    return `---\n${yaml}\n---\n\n${input.body.trim()}\n`;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.+/g, '-');
}
