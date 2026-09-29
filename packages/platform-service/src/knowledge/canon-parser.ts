import {
  CanonRecordInputSchema,
  CanonRecordSchema,
  compile,
  RpcError,
  RpcErrorCode,
  ValidationError,
  type CanonRecord,
  type CanonRecordInput,
} from '@gamecrafter/contracts';
import { parseDocument } from 'yaml';

const inputValidator = compile<CanonRecordInput>(CanonRecordInputSchema);
const recordValidator = compile<CanonRecord>(CanonRecordSchema);

export interface CanonParseOptions {
  path: string;
  revision: string;
  active: boolean;
  indexedAt: string;
  recordTypes: readonly string[];
}

export interface ParsedCanonRecord {
  record: CanonRecord;
  body: string;
}

export class CanonParser {
  parse(markdown: string, options: CanonParseOptions): ParsedCanonRecord {
    if (options.path.startsWith('docs/decisions/')) {
      return this.parseDecision(markdown, options);
    }
    const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines[0]?.trim() !== '---') {
      throw canonInvalid(options.path, ['Missing YAML front matter.']);
    }
    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (closingIndex < 0) {
      throw canonInvalid(options.path, ['Unterminated YAML front matter.']);
    }

    const document = parseDocument(lines.slice(1, closingIndex).join('\n'), { uniqueKeys: true });
    if (document.errors.length > 0) {
      throw canonInvalid(
        options.path,
        document.errors.map((error) => error.message),
      );
    }
    const frontmatter: unknown = document.toJS();
    if (!isRecord(frontmatter)) {
      throw canonInvalid(options.path, ['YAML front matter must be a mapping.']);
    }
    if (frontmatter.schemaVersion !== 1) {
      throw canonInvalid(options.path, ['schemaVersion must be 1.']);
    }
    if (typeof frontmatter.type !== 'string' || !options.recordTypes.includes(frontmatter.type)) {
      throw canonInvalid(options.path, [`Unknown record type: ${String(frontmatter.type ?? '')}`]);
    }

    let input: CanonRecordInput;
    try {
      input = inputValidator.assert({
        id: frontmatter.id,
        type: frontmatter.type,
        title: frontmatter.title,
        status: frontmatter.status,
        ...(frontmatter.module === undefined ? {} : { module: frontmatter.module }),
        tags: frontmatter.tags ?? [],
        references: frontmatter.references ?? [],
        provenance: frontmatter.provenance ?? [],
        ...(frontmatter.supersedes === undefined ? {} : { supersedes: frontmatter.supersedes }),
      });
    } catch (error) {
      throw canonInvalid(options.path, validationMessages(error));
    }
    const body = lines
      .slice(closingIndex + 1)
      .join('\n')
      .replace(/^\n+|\n+$/g, '');
    let record: CanonRecord;
    try {
      record = recordValidator.assert({
        schemaVersion: 1,
        ...input,
        path: options.path,
        bodyExcerpt: body.replace(/\s+/g, ' ').slice(0, 320),
        revision: options.revision,
        active: options.active,
        indexedAt: options.indexedAt,
      });
    } catch (error) {
      throw canonInvalid(options.path, validationMessages(error));
    }
    return { record, body };
  }

  private parseDecision(markdown: string, options: CanonParseOptions): ParsedCanonRecord {
    const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines[0]?.trim() !== '---')
      throw canonInvalid(options.path, ['Missing YAML front matter.']);
    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (closingIndex < 0) throw canonInvalid(options.path, ['Unterminated YAML front matter.']);
    const document = parseDocument(lines.slice(1, closingIndex).join('\n'), { uniqueKeys: true });
    if (document.errors.length > 0) {
      throw canonInvalid(
        options.path,
        document.errors.map((error) => error.message),
      );
    }
    const frontmatter: unknown = document.toJS();
    if (!isRecord(frontmatter) || typeof frontmatter.decisionId !== 'string') {
      throw canonInvalid(options.path, ['Decision front matter is missing decisionId.']);
    }
    const body = lines
      .slice(closingIndex + 1)
      .join('\n')
      .replace(/^\n+|\n+$/g, '');
    const title = body.match(/^#\s+(.+?)\s*$/m)?.[1];
    if (!title) throw canonInvalid(options.path, ['Decision body is missing a title heading.']);
    const id = decisionRecordId(frontmatter.decisionId);
    const supersedes =
      typeof frontmatter.supersedes === 'string' && frontmatter.supersedes !== 'null'
        ? decisionRecordId(frontmatter.supersedes)
        : undefined;
    const input: CanonRecordInput = {
      id,
      type: 'decision',
      title,
      status: frontmatter.status === 'superseded' ? 'retconned' : 'accepted',
      tags: [],
      references: supersedes
        ? [{ rel: 'supersedes', target: supersedes, confidence: 1, source: 'decision' }]
        : [],
      provenance: [
        {
          kind: 'decision',
          ref: frontmatter.decisionId,
          at: typeof frontmatter.boundAt === 'string' ? frontmatter.boundAt : options.indexedAt,
        },
      ],
      ...(supersedes ? { supersedes } : {}),
    };
    let record: CanonRecord;
    try {
      record = recordValidator.assert({
        schemaVersion: 1,
        ...input,
        path: options.path,
        bodyExcerpt: body.replace(/\s+/g, ' ').slice(0, 320),
        revision: options.revision,
        active: options.active,
        indexedAt: options.indexedAt,
      });
    } catch (error) {
      throw canonInvalid(options.path, validationMessages(error));
    }
    return { record, body };
  }
}

function decisionRecordId(decisionId: string): string {
  return `decision.${decisionId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

function canonInvalid(path: string, errors: string[]): RpcError {
  const details = errors.length > 0 ? errors : ['Invalid canon record.'];
  return new RpcError(
    `Invalid canon record at ${path}: ${details.join('; ')}`,
    RpcErrorCode.CanonRecordInvalid,
    { errors: details },
  );
}

function validationMessages(error: unknown): string[] {
  if (error instanceof ValidationError) return error.errors;
  return [error instanceof Error ? error.message : String(error)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
