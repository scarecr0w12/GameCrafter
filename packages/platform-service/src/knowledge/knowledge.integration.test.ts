import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { RpcErrorCode, uuidv7 } from '@gamecrafter/contracts';
import { KnowledgeStore } from './knowledge-store';
import type { VectorPoint, VectorSearchHit, VectorStore } from './vector-store';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let closeFakeProvider: (() => Promise<void>) | undefined;
let fakeEmbeddingRequests = 0;

afterEach(async () => {
  await client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  await closeFakeProvider?.();
  closeFakeProvider = undefined;
  fakeEmbeddingRequests = 0;
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('knowledge service integration', () => {
  it('reconciles canon, decision, board, code, and asset metadata with citations and idempotence', async () => {
    await startService();
    const project = await client!.call('project/create', {
      name: 'Knowledge Index Smoke',
      engine: { family: 'godot' },
      modules: ['story'],
      parentDirectory: path.join(temporaryDirectories[0]!, 'projects'),
      folderName: 'knowledge-index-smoke',
    });
    const canonPath = path.join(project.path, 'docs', 'canon', 'characters', 'aria.md');
    const inactivePath = path.join(project.path, 'docs', 'canon', 'characters', 'sleeping.md');
    const decisionPath = path.join(project.path, 'docs', 'decisions', 'choice.md');
    const codePath = path.join(project.path, 'game', 'src', 'harbor.ts');
    const assetPath = path.join(project.path, 'game', 'assets', 'artifact.png');
    for (const filePath of [canonPath, inactivePath, decisionPath, codePath, assetPath]) {
      mkdirSync(path.dirname(filePath), { recursive: true });
    }
    writeFileSync(
      canonPath,
      `---\nschemaVersion: 1\nid: char.aria-vale\ntype: character\ntitle: Aria Vale\nstatus: accepted\nmodule: story\ntags: [navigator]\nreferences:\n  - rel: located-in\n    target: loc.harborfall\n    confidence: 1\n    source: author\nprovenance:\n  - kind: user\n    ref: user\n    at: 2026-09-29T12:00:00.000Z\n---\nAria navigates the Harborfall channel at dawn.`,
    );
    writeFileSync(
      inactivePath,
      `---\nschemaVersion: 1\nid: char.sleeping-keeper\ntype: character\ntitle: Sleeping Keeper\nstatus: draft\nmodule: disabled-story\ntags: []\nreferences: []\nprovenance: []\n---\nQuartz lanterns sleep beneath the old archive.`,
    );
    writeFileSync(
      decisionPath,
      `---\ndecisionId: ${uuidv7()}\nthreadId: ${uuidv7()}\nmessageId: ${uuidv7()}\nboundAt: 2026-09-29T12:00:00.000Z\nmadeBy: user\nsupersedes: null\nstatus: binding\n---\n# Keep the western harbor open\n\nThe western harbor remains open during winter.`,
    );
    writeFileSync(codePath, 'export function harborRoute() { return "north quay"; }\n');
    writeFileSync(assetPath, Buffer.from('DO_NOT_INDEX_BINARY_PRIVATE_MARKER'));

    const thread = await client!.call('board/createThread', {
      projectId: project.projectId,
      title: 'Harbor inspection',
      kind: 'discussion',
      tags: ['harbor'],
      body: 'The lighthouse lens is missing from Harborfall.',
      type: 'finding',
    });

    const firstTask = await client!.call('knowledge/index/reconcile', {
      projectId: project.projectId,
    });
    await waitForTask(project.projectId, firstTask.taskId);

    const status = await client!.call('knowledge/index/status', { projectId: project.projectId });
    expect(status.records).toBe(3);
    expect(status.chunks).toBeGreaterThanOrEqual(5);
    expect(status.conflicts).toEqual([]);
    expect(status.brokenReferences).toMatchObject([
      { recordId: 'char.aria-vale', target: 'loc.harborfall' },
    ]);

    const activeRecords = await client!.call('knowledge/records', {
      projectId: project.projectId,
      type: 'character',
    });
    expect(activeRecords.records.map((record) => record.id)).toEqual(['char.aria-vale']);
    const includingInactive = await client!.call('knowledge/records', {
      projectId: project.projectId,
      type: 'character',
      includeInactive: true,
    });
    expect(includingInactive.records.map((record) => record.id)).toContain('char.sleeping-keeper');

    const hit = await client!.call('knowledge/search', {
      projectId: project.projectId,
      query: 'Harborfall channel',
      sources: ['canon'],
      recordTypes: ['character'],
      statuses: ['accepted'],
      mode: 'lexical',
    });
    expect(hit.hits[0]).toMatchObject({
      recordId: 'char.aria-vale',
      path: 'docs/canon/characters/aria.md',
      quote: { text: expect.stringContaining('Harborfall'), startLine: expect.any(Number) },
    });
    expect(hit.hits[0]?.citation).toContain('docs/canon/characters/aria.md@');
    expect(hit.hits[0]?.citation).toContain('[char.aria-vale]');

    const decisionHit = await client!.call('knowledge/search', {
      projectId: project.projectId,
      query: 'western harbor open',
      sources: ['decisions'],
      mode: 'lexical',
    });
    expect(decisionHit.hits[0]?.recordStatus).toBe('accepted');
    const boardHit = await client!.call('knowledge/search', {
      projectId: project.projectId,
      query: 'lighthouse lens',
      sources: ['board'],
      mode: 'lexical',
    });
    expect(boardHit.hits[0]?.path).toContain(thread.thread.threadId);
    const codeHit = await client!.call('knowledge/search', {
      projectId: project.projectId,
      query: 'north quay',
      sources: ['code'],
      mode: 'lexical',
    });
    expect(codeHit.hits[0]?.path).toBe('game/src/harbor.ts');
    const leaked = await client!.call('knowledge/search', {
      projectId: project.projectId,
      query: 'DO_NOT_INDEX_BINARY_PRIVATE_MARKER',
      mode: 'lexical',
    });
    expect(leaked.hits).toEqual([]);

    const record = await client!.call('knowledge/record', {
      projectId: project.projectId,
      recordId: 'char.aria-vale',
    });
    expect(record.body).toContain('Harborfall channel');
    expect(record.outbound[0]?.target).toBe('loc.harborfall');
    expect(record.inbound).toEqual([]);
    const graph = await client!.call('knowledge/graph', {
      projectId: project.projectId,
      recordId: 'char.aria-vale',
    });
    expect(graph.edges[0]?.target).toBe('loc.harborfall');

    await client!.call('project/trust', { projectId: project.projectId, trusted: true });
    await client!.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    const proposal = await client!.call('knowledge/write', {
      projectId: project.projectId,
      record: {
        id: 'quest.harbor-lantern',
        type: 'quest',
        title: 'Restore the Harbor Lantern',
        status: 'draft',
      },
      body: 'Find the missing lantern lens.',
    });
    expect(proposal.status).toBe('draft');
    expect(proposal.provenance.at(-1)).toMatchObject({ kind: 'user', ref: 'user' });
    const accepted = await client!.call('knowledge/setStatus', {
      projectId: project.projectId,
      recordId: proposal.id,
      status: 'accepted',
      justification: { kind: 'user', ref: 'user' },
    });
    expect(accepted.status).toBe('accepted');
    const retcon = await client!.call('knowledge/write', {
      projectId: project.projectId,
      record: {
        id: 'char.aria-vale-v2',
        type: 'character',
        title: 'Aria Vale, Reimagined',
        status: 'accepted',
        supersedes: 'char.aria-vale',
      },
      body: 'Aria now follows the northern sea lane.',
    });
    expect(retcon.supersedes).toBe('char.aria-vale');
    expect(
      (
        await client!.call('knowledge/record', {
          projectId: project.projectId,
          recordId: 'char.aria-vale',
        })
      ).record.status,
    ).toBe('retconned');

    const database = Database.open(path.join(project.path, '.gamecrafter', 'project.sqlite'));
    const before = new KnowledgeStore(database).stateHash();
    const noOpTask = await client!.call('knowledge/index/reconcile', {
      projectId: project.projectId,
    });
    await waitForTask(project.projectId, noOpTask.taskId);
    const after = new KnowledgeStore(database).stateHash();
    database.close();
    expect(after).toBe(before);

    writeFileSync(
      canonPath,
      readFileSync(canonPath, 'utf8').replace('Harborfall channel', 'Harborfall sea lane'),
    );
    const changedTask = await client!.call('knowledge/index/reconcile', {
      projectId: project.projectId,
    });
    await waitForTask(project.projectId, changedTask.taskId);
    expect(
      (
        await client!.call('knowledge/search', {
          projectId: project.projectId,
          query: 'sea lane',
          sources: ['canon'],
          mode: 'lexical',
        })
      ).hits[0]?.recordId,
    ).toBe('char.aria-vale-v2');
    rmSync(inactivePath);
    const deletedTask = await client!.call('knowledge/index/reconcile', {
      projectId: project.projectId,
    });
    await waitForTask(project.projectId, deletedTask.taskId);
    expect(
      (
        await client!.call('knowledge/records', {
          projectId: project.projectId,
          includeInactive: true,
        })
      ).records.map((entry) => entry.id),
    ).not.toContain('char.sleeping-keeper');
  }, 60_000);

  it('embeds with the fake provider and excludes another Project from lexical and semantic search', async () => {
    const vectors = new SharedFakeVectorStore();
    const fakeProvider = await startFakeEmbeddingProvider();
    closeFakeProvider = fakeProvider.close;
    await startService(() => vectors);
    const account = await client!.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'WP14 fake embeddings',
      baseUrl: fakeProvider.baseUrl,
      apiKey: 'test-embedding-key',
      isLocal: true,
    });
    const discovery = await client!.call('model/discover', { accountId: account.accountId });
    const model = discovery.models.find((entry) => entry.capabilities.embeddings);
    expect(model).toBeDefined();

    const parentDirectory = path.join(temporaryDirectories[0]!, 'semantic-projects');
    const projects = [];
    for (const name of ['Semantic Alpha', 'Semantic Beta']) {
      const project = await client!.call('project/create', {
        name,
        engine: { family: 'godot' },
        parentDirectory,
        folderName: name === 'Semantic Alpha' ? 'alpha' : 'beta',
      });
      projects.push(project);
    }
    for (const [project, slug, title, phrase] of [
      [projects[0]!, 'alpha', 'Alpha location', 'alpha-jade-3176'],
      [projects[1]!, 'beta', 'Beta location', 'beta-quartz-9284'],
    ] as const) {
      const filePath = path.join(project.path, 'docs', 'canon', 'locations', `${slug}.md`);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(
        filePath,
        `---\nschemaVersion: 1\nid: loc.${slug}-secret\ntype: location\ntitle: ${title}\nstatus: accepted\ntags: []\nreferences: []\nprovenance: []\n---\n${phrase}`,
      );
      await client!.call('knowledge/embeddingProfile/set', {
        projectId: project.projectId,
        modelId: model!.modelId,
        providerAccountId: account.accountId,
      });
      const task = await client!.call('knowledge/index/reconcile', {
        projectId: project.projectId,
      });
      await waitForTask(project.projectId, task.taskId);
    }

    expect(fakeEmbeddingRequests).toBeGreaterThan(0);
    const alphaId = projects[0]!.projectId;
    const betaId = projects[1]!.projectId;
    const lexicalLeak = await client!.call('knowledge/search', {
      projectId: alphaId,
      query: 'beta-quartz-9284',
      mode: 'lexical',
    });
    const semanticLeak = await client!.call('knowledge/search', {
      projectId: alphaId,
      query: 'beta-quartz-9284',
      mode: 'semantic',
    });
    const betaHit = await client!.call('knowledge/search', {
      projectId: betaId,
      query: 'beta-quartz-9284',
      mode: 'semantic',
    });
    expect(lexicalLeak.hits).toEqual([]);
    expect(semanticLeak.hits).toEqual([]);
    expect(betaHit.hits[0]?.recordId).toBe('loc.beta-secret');
  }, 60_000);

  it("does not return another Project's lexical content from knowledge/search", async () => {
    await startService();
    const parentDirectory = path.join(temporaryDirectories[0]!, 'leakage-projects');
    const projects = [];
    for (const name of ['Knowledge Alpha', 'Knowledge Beta']) {
      const project = await client!.call('project/create', {
        name,
        engine: { family: 'godot' },
        parentDirectory,
        folderName: name === 'Knowledge Alpha' ? 'alpha' : 'beta',
      });
      projects.push(project);
    }
    const beta = projects[1]!;
    const recordPath = path.join(beta.path, 'docs', 'canon', 'locations', 'beta.md');
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(
      recordPath,
      `---\nschemaVersion: 1\nid: loc.beta-only\ntype: location\ntitle: Beta-only location\nstatus: accepted\ntags: []\nreferences: []\nprovenance: []\n---\nproject-beta-exclusive-phrase`,
    );
    const task = await client!.call('knowledge/index/reconcile', { projectId: beta.projectId });
    await waitForTask(beta.projectId, task.taskId);

    const alphaSearch = await client!.call('knowledge/search', {
      projectId: projects[0]!.projectId,
      query: 'project-beta-exclusive-phrase',
      mode: 'lexical',
    });
    const betaSearch = await client!.call('knowledge/search', {
      projectId: beta.projectId,
      query: 'project-beta-exclusive-phrase',
      mode: 'lexical',
    });
    expect(alphaSearch.hits).toEqual([]);
    expect(betaSearch.hits[0]?.recordId).toBe('loc.beta-only');
  }, 60_000);

  it('reports duplicate canon IDs and indexes an unknown record type as documentation', async () => {
    await startService();
    const project = await client!.call('project/create', {
      name: 'Knowledge Conflict Smoke',
      engine: { family: 'godot' },
      parentDirectory: path.join(temporaryDirectories[0]!, 'conflict-projects'),
      folderName: 'knowledge-conflict-smoke',
    });
    const firstPath = path.join(project.path, 'docs', 'canon', 'characters', 'first.md');
    const secondPath = path.join(project.path, 'docs', 'canon', 'characters', 'second.md');
    const unknownPath = path.join(project.path, 'docs', 'canon', 'unknown', 'record.md');
    for (const filePath of [firstPath, secondPath, unknownPath])
      mkdirSync(path.dirname(filePath), { recursive: true });
    const frontmatter = (title: string) =>
      `---\nschemaVersion: 1\nid: char.shared\ntype: character\ntitle: ${title}\nstatus: accepted\ntags: []\nreferences: []\nprovenance: []\n---\n${title} shares the same identifier.`;
    writeFileSync(firstPath, frontmatter('First record'));
    writeFileSync(secondPath, frontmatter('Second record'));
    writeFileSync(
      unknownPath,
      `---\nschemaVersion: 1\nid: item.unknown-lore\ntype: unregistered-kind\ntitle: Unknown lore\nstatus: accepted\ntags: []\nreferences: []\nprovenance: []\n---\nunregistered-lore-phrase stays searchable as documentation.`,
    );
    const task = await client!.call('knowledge/index/reconcile', { projectId: project.projectId });
    await waitForTask(project.projectId, task.taskId);

    const status = await client!.call('knowledge/index/status', { projectId: project.projectId });
    expect(status.conflicts).toMatchObject([
      {
        id: 'char.shared',
        paths: expect.arrayContaining([
          'docs/canon/characters/first.md',
          'docs/canon/characters/second.md',
        ]),
      },
    ]);
    await expect(
      client!.call('knowledge/record', { projectId: project.projectId, recordId: 'char.shared' }),
    ).rejects.toMatchObject({
      code: RpcErrorCode.CanonDuplicateId,
    });
    const fallback = await client!.call('knowledge/search', {
      projectId: project.projectId,
      query: 'unregistered-lore-phrase',
      sources: ['docs'],
      mode: 'lexical',
    });
    expect(fallback.hits[0]).toMatchObject({
      path: 'docs/canon/unknown/record.md',
      recordId: null,
    });
  }, 60_000);
});

async function startService(
  knowledgeVectorStoreFactory?: (projectId: string) => VectorStore,
): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-knowledge-integration-'));
  temporaryDirectories.push(root);
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
  service = await PlatformService.start({
    paths,
    platformVersion: '0.1.0',
    ...(knowledgeVectorStoreFactory ? { knowledgeVectorStoreFactory } : {}),
  });
  client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'knowledge-integration-test',
    clientVersion: '0.1.0',
  });
}

async function waitForTask(projectId: string, taskId: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (task.state === 'succeeded') return;
    if (task.state === 'failed' || task.state === 'blocked') {
      throw new Error(`Knowledge task ${taskId} ended ${task.state}: ${task.error?.message ?? ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Knowledge task did not complete: ${taskId}`);
}

async function startFakeEmbeddingProvider(): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/v1/models') {
      sendJson(response, 200, {
        data: [{ id: 'wp14-fake-embedding-model', capabilities: { chat: true, embeddings: true } }],
      });
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/embeddings') {
      void (async () => {
        let text = '';
        for await (const chunk of request) text += chunk;
        const inputs = (JSON.parse(text) as { input?: unknown }).input;
        const values = Array.isArray(inputs) ? inputs.map(String) : [];
        fakeEmbeddingRequests += 1;
        sendJson(response, 200, {
          data: values.map((value, index) => ({ index, embedding: embeddingFor(value) })),
          usage: { prompt_tokens: values.length },
        });
      })();
      return;
    }
    sendJson(response, 404, { error: 'not found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

class SharedFakeVectorStore implements VectorStore {
  readonly kind = 'qdrant' as const;
  private readonly points = new Map<string, VectorPoint>();

  async ensureCollection(profile: { projectId: string; version: number }): Promise<string> {
    return `shared-test-${profile.projectId}-v${profile.version}`;
  }

  async upsert(_profile: { projectId: string }, points: VectorPoint[]): Promise<void> {
    for (const point of points) this.points.set(point.id, point);
  }

  async delete(_profile: { projectId: string }, pointIds: string[]): Promise<void> {
    for (const pointId of pointIds) this.points.delete(pointId);
  }

  async search(
    _profile: { projectId: string },
    vector: number[],
    _filter: Record<string, unknown>,
    limit: number,
  ): Promise<VectorSearchHit[]> {
    return [...this.points.values()]
      .map((point) => ({
        id: point.id,
        score: point.vector.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0),
        payload: point.payload,
      }))
      .filter((hit) => hit.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async count(profile: { projectId: string }): Promise<number> {
    return [...this.points.values()].filter(
      (point) => point.payload.projectId === profile.projectId,
    ).length;
  }

  async health(profile?: {
    projectId: string;
  }): Promise<{ kind: 'qdrant'; reachable: true; collection: string | null; error: null }> {
    return {
      kind: 'qdrant',
      reachable: true,
      collection: profile ? `shared-test-${profile.projectId}-v1` : null,
      error: null,
    };
  }
}

function embeddingFor(input: string): number[] {
  const text = input.toLowerCase();
  if (text.includes('beta-quartz-9284')) return [0, 1];
  if (text.includes('alpha-jade-3176')) return [1, 0];
  return [1, 0];
}

function sendJson(
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}
