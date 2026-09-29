import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type CanonRecord, type KnowledgeChunk } from '@gamecrafter/contracts';
import { KnowledgeStore, type IndexedKnowledgePath } from './knowledge-store';

let database: Database | undefined;
afterEach(() => {
  database?.close();
  database = undefined;
});

describe('KnowledgeStore', () => {
  it('indexes FTS rows atomically with chunks and removes stale path content', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/aria.md', 'Harborfall navigator', 'first'),
    );
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toHaveLength(1);

    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/aria.md', 'Moonlit lighthouse', 'second'),
    );
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toHaveLength(0);
    expect(store.searchLexical(projectId, 'lighthouse', {}, 10)).toHaveLength(1);
    store.removeIndexedPath('docs/canon/aria.md');
    expect(store.searchLexical(projectId, 'lighthouse', {}, 10)).toHaveLength(0);
  });

  it('retains same-id records at separate paths so reconciliation can report conflicts', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/a.md', 'Aria lives in Harborfall', 'a'),
    );
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/b.md', 'Aria lives in North Gate', 'b'),
    );
    expect(store.recordsById('char.aria-vale')).toHaveLength(2);
  });
});

function indexedPath(
  projectId: string,
  path: string,
  text: string,
  suffix: string,
): IndexedKnowledgePath {
  const indexedAt = new Date().toISOString();
  const record: CanonRecord = {
    schemaVersion: 1,
    id: 'char.aria-vale',
    type: 'character',
    title: 'Aria Vale',
    status: 'draft',
    tags: [],
    references: [],
    provenance: [],
    path,
    bodyExcerpt: text,
    revision: 'worktree',
    active: true,
    indexedAt,
  };
  const chunk: KnowledgeChunk = {
    chunkId: `${suffix}`.padStart(64, '0'),
    projectId,
    source: 'canon',
    path,
    recordId: record.id,
    revision: record.revision,
    startLine: 1,
    endLine: 1,
    text,
    tokensEstimate: 5,
  };
  return {
    path,
    source: 'canon',
    revision: record.revision,
    contentHash: suffix,
    mtimeMs: 1,
    size: text.length,
    chunkCount: 1,
    indexedAt,
    record,
    body: text,
    chunks: [chunk],
  };
}
