import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type EmbeddingProfile, type SearchRequest } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { KnowledgeStore, type IndexedKnowledgePath } from './knowledge-store';
import { KnowledgeRetriever } from './retriever';
import type { VectorSearchHit, VectorStore } from './vector-store';

let database: Database | undefined;
let secondDatabase: Database | undefined;
afterEach(() => {
  database?.close();
  secondDatabase?.close();
  database = undefined;
  secondDatabase = undefined;
});

describe('KnowledgeRetriever', () => {
  it('returns lexical quotes and citations and prefers a semantic accepted record in hybrid mode', async () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    const lexical = indexed(
      projectId,
      'char.old-lighthouse',
      'draft',
      'docs/canon/old.md',
      'astral moon appears in the old logbook',
    );
    const semantic = indexed(
      projectId,
      'char.lunar-sailor',
      'accepted',
      'docs/canon/sailor.md',
      'The sailor follows lunar tides across Harborfall',
    );
    store.replaceIndexedPath(lexical);
    store.replaceIndexedPath(semantic);
    const profile: EmbeddingProfile = {
      profileId: uuidv7(),
      projectId,
      modelId: 'fake-embeddings',
      providerAccountId: uuidv7(),
      dimensions: 2,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    store.setEmbeddingProfile(profile);
    const semanticChunkId = semantic.chunks[0]!.chunkId;
    const semanticPointId = uuidv7();
    store.saveVectorMapping({
      chunkId: semanticChunkId,
      projectId,
      profileVersion: profile.version,
      pointId: semanticPointId,
      collection: 'fake_collection',
      createdAt: new Date().toISOString(),
    });
    const vectorStore = fakeVectorStore([
      { id: semanticPointId, score: 0.99, payload: { projectId, chunkId: semanticChunkId } },
    ]);
    const retriever = new KnowledgeRetriever({
      store: () => store,
      embeddingProfile: () => profile,
      vectorStore: () => vectorStore,
      embed: async (_modelId, inputs) => ({
        vectors: inputs.map(() => [1, 0]),
        usage: { inputTokens: 1, outputTokens: 0, costUsd: 0 },
      }),
    });

    const lexicalRequest: SearchRequest = { projectId, query: 'astral moon', mode: 'lexical' };
    const lexicalResult = await retriever.search(lexicalRequest);
    expect(lexicalResult.hits[0]).toMatchObject({
      recordId: 'char.old-lighthouse',
      source: 'canon',
      quote: { text: expect.stringContaining('astral moon'), startLine: 1, endLine: 1 },
      citation: expect.stringContaining('docs/canon/old.md@worktree#L1-L1'),
    });
    expect(lexicalResult.degraded).toBeNull();

    const hybrid = await retriever.search({ ...lexicalRequest, mode: 'hybrid' });
    expect(hybrid.hits[0]?.recordId).toBe('char.lunar-sailor');
    expect(hybrid.hits[0]?.semanticRank).toBe(1);
    expect(hybrid.hits[0]?.citation).toContain('[char.lunar-sailor]');
    expect(hybrid.degraded).toBeNull();
  });

  it('keeps lexical and semantic results isolated to the requested Project', async () => {
    database = Database.open(':memory:');
    secondDatabase = Database.open(':memory:');
    migrate(database, projectMigrations);
    migrate(secondDatabase, projectMigrations);
    const projectA = uuidv7();
    const projectB = uuidv7();
    const storeA = new KnowledgeStore(database);
    const storeB = new KnowledgeStore(secondDatabase);
    const beta = indexed(
      projectB,
      'char.beta',
      'accepted',
      'docs/canon/beta.md',
      'project-beta-exclusive-term',
    );
    storeB.replaceIndexedPath(beta);
    const profileA: EmbeddingProfile = {
      profileId: uuidv7(),
      projectId: projectA,
      modelId: 'fake-embeddings',
      providerAccountId: uuidv7(),
      dimensions: 2,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    storeA.setEmbeddingProfile(profileA);
    const foreignHit = {
      id: uuidv7(),
      score: 0.99,
      payload: { projectId: projectB, chunkId: beta.chunks[0]!.chunkId },
    };
    const retriever = new KnowledgeRetriever({
      store: () => storeA,
      embeddingProfile: () => profileA,
      vectorStore: () => fakeVectorStore([foreignHit]),
      embed: async (_modelId, inputs) => ({ vectors: inputs.map(() => [1, 0]) }),
    });

    const lexical = await retriever.search({
      projectId: projectA,
      query: 'project-beta-exclusive-term',
      mode: 'lexical',
    });
    const semantic = await retriever.search({
      projectId: projectA,
      query: 'project-beta-exclusive-term',
      mode: 'hybrid',
    });
    expect(lexical.hits).toEqual([]);
    expect(semantic.hits).toEqual([]);
  });

  it('ranks declared task resources and fits complete quotes within an estimated token budget', async () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexed(projectId, 'char.large', 'accepted', 'docs/large.md', 'Harborfall '.repeat(300)),
    );
    store.replaceIndexedPath(
      indexed(
        projectId,
        'char.sailor',
        'draft',
        'docs/sailor.md',
        'Harborfall sailor repairs the lighthouse',
      ),
    );
    store.replaceIndexedPath(
      indexed(projectId, 'char.docks', 'draft', 'docs/docks.md', 'Harborfall docks open tomorrow'),
    );
    const taskId = uuidv7();
    const retriever = new KnowledgeRetriever({
      store: () => store,
      embeddingProfile: () => null,
      vectorStore: () => fakeVectorStore([]),
      embed: async () => ({ vectors: [] }),
      taskContext: (requestedProject, requestedTask) => {
        expect(requestedProject).toBe(projectId);
        expect(requestedTask).toBe(taskId);
        return { goal: 'Repair the lighthouse', resources: ['file:docs/sailor.md'] };
      },
    });
    const relevant = await retriever.search({
      projectId,
      taskId,
      query: 'Harborfall',
      mode: 'lexical',
    });
    expect(relevant.hits[0]?.path).toBe('docs/sailor.md');
    const budgeted = await retriever.search({
      projectId,
      taskId,
      query: 'Harborfall',
      mode: 'lexical',
      maxTokens: 45,
    });
    expect(budgeted.hits).toHaveLength(1);
    expect(budgeted.hits[0]?.quote.text).toBe('Harborfall sailor repairs the lighthouse');
    expect(budgeted.hits[0]?.citation).toContain('#L1-L1');
    expect(
      (await retriever.search({ projectId, query: 'Harborfall', mode: 'lexical', maxTokens: 0 }))
        .hits,
    ).toEqual([]);
  });

  it('degrades cleanly to lexical results when semantic search is disabled', async () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexed(
        projectId,
        'char.aria-vale',
        'accepted',
        'docs/canon/aria.md',
        'Harborfall opens at dawn',
      ),
    );
    const retriever = new KnowledgeRetriever({
      store: () => store,
      embeddingProfile: () => null,
      vectorStore: () => fakeVectorStore([]),
      embed: async () => ({ vectors: [], usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } }),
    });
    const result = await retriever.search({ projectId, query: 'Harborfall', mode: 'hybrid' });
    expect(result.hits[0]?.recordId).toBe('char.aria-vale');
    expect(result.degraded).toMatch(/embedding profile/i);
  });
});

function indexed(
  projectId: string,
  id: string,
  status: 'draft' | 'accepted',
  recordPath: string,
  text: string,
): IndexedKnowledgePath {
  const indexedAt = new Date().toISOString();
  const record = {
    schemaVersion: 1 as const,
    id,
    type: 'character',
    title: id,
    status,
    tags: [],
    references: [],
    provenance: [],
    path: recordPath,
    bodyExcerpt: text,
    revision: 'worktree',
    active: true,
    indexedAt,
  };
  return {
    path: recordPath,
    source: 'canon',
    revision: 'worktree',
    contentHash: text,
    mtimeMs: 1,
    size: text.length,
    chunkCount: 1,
    indexedAt,
    record,
    body: text,
    chunks: [
      {
        chunkId: id.padEnd(64, '0').slice(0, 64),
        projectId,
        source: 'canon',
        path: recordPath,
        recordId: id,
        revision: 'worktree',
        startLine: 1,
        endLine: 1,
        text,
        tokensEstimate: Math.ceil(text.length / 4),
      },
    ],
  };
}

function fakeVectorStore(hits: VectorSearchHit[]): VectorStore {
  return {
    kind: 'qdrant',
    async ensureCollection() {
      return 'fake_collection';
    },
    async upsert() {},
    async delete() {},
    async search() {
      return hits;
    },
    async count() {
      return hits.length;
    },
    async health() {
      return { kind: 'qdrant', reachable: true, collection: 'fake_collection', error: null };
    },
  };
}
