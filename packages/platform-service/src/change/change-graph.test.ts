import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  uuidv7,
  type CanonRecord,
  type ChangeEdge,
  type ChangeNode,
  type TaskRecord,
  type ToolCallRecord,
} from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { ChangeGraphStore } from './change-graph-store';
import { calculateImpact, ChangeGraph } from './change-graph';

const now = '2026-09-29T00:00:00.000Z';

describe('ChangeGraph', () => {
  it('rebuilds canon, task, tool, and inferred source edges idempotently', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-change-graph-'));
    const database = Database.open(':memory:');
    const projectId = uuidv7();
    const taskId = uuidv7();
    const store = new ChangeGraphStore(database);
    try {
      migrate(database, projectMigrations);
      mkdirSync(path.join(root, 'docs', 'canon'), { recursive: true });
      mkdirSync(path.join(root, 'game', 'assets'), { recursive: true });
      writeFileSync(path.join(root, 'docs', 'canon', 'overview.md'), 'char.aria-vale');
      writeFileSync(
        path.join(root, 'game', 'main.tscn'),
        '[ext_resource path="res://assets/aria.png" type="Texture2D"]\n',
      );
      writeFileSync(path.join(root, 'game', 'README.md'), 'Gameplay source.');
      writeFileSync(path.join(root, 'game', 'assets', 'aria.png'), 'fake image');
      const canonRecords: CanonRecord[] = [
        {
          schemaVersion: 1,
          id: 'char.aria-vale',
          type: 'character',
          title: 'Aria Vale',
          status: 'accepted',
          tags: [],
          references: [
            {
              rel: 'appears-in',
              target: 'quest.harbor-rescue',
              confidence: 1,
              source: 'author',
            },
          ],
          provenance: [],
          path: 'docs/canon/aria.md',
          bodyExcerpt: '',
          revision: 'a'.repeat(40),
          active: true,
          indexedAt: now,
        },
        {
          schemaVersion: 1,
          id: 'quest.harbor-rescue',
          type: 'quest',
          title: 'Harbor Rescue',
          status: 'accepted',
          tags: [],
          references: [],
          provenance: [],
          path: 'docs/canon/quest.md',
          bodyExcerpt: '',
          revision: 'b'.repeat(40),
          active: true,
          indexedAt: now,
        },
      ];
      const task: TaskRecord = {
        schemaVersion: 1,
        taskId,
        projectId,
        parentTaskId: null,
        rootTaskId: taskId,
        depth: 0,
        kind: 'agent.run',
        title: 'Update gameplay docs',
        goal: 'Update gameplay docs',
        goalHash: 'c'.repeat(64),
        state: 'succeeded',
        priority: 50,
        dependsOn: [],
        assignee: null,
        touches: [{ resource: 'file:game/README.md', intent: 'write' }],
        budget: {},
        spent: { costUsd: 0, tokens: 0 },
        attempt: 1,
        maxAttempts: 3,
        lease: null,
        input: {},
        checkpoint: null,
        result: {
          summary: 'Updated docs',
          artifacts: [{ kind: 'file', path: 'game/README.md' }],
          evidence: [],
        },
        error: null,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        finishedAt: now,
      };
      const toolCall: ToolCallRecord = {
        callId: uuidv7(),
        projectId,
        taskId,
        agentId: null,
        toolId: 'fs/write-file',
        input: { path: 'game/README.md', content: 'Gameplay source.' },
        accessMode: 'full',
        decision: 'allowed',
        decisionReason: 'full_access',
        status: 'completed',
        output: { bytes: 16 },
        error: null,
        evidence: [{ kind: 'file', ref: 'game/README.md' }],
        costUsd: 0,
        startedAt: now,
        finishedAt: now,
      };
      const graph = new ChangeGraph({
        storeForProject: () => store,
        now: () => new Date(now),
        sources: {
          projectPath: () => root,
          canonRecords: () => canonRecords,
          tasks: () => [task],
          toolCalls: () => [toolCall],
        },
      });

      graph.rebuildGraph(projectId);
      const firstEdges = store.edges(projectId);
      graph.rebuildGraph(projectId);
      const secondEdges = store.edges(projectId);

      expect(secondEdges).toEqual(firstEdges);
      expect(secondEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from: 'canon:char.aria-vale',
            to: 'canon:quest.harbor-rescue',
            source: 'author',
            confidence: 1,
          }),
          expect.objectContaining({
            from: `task:${taskId}`,
            to: 'file:game/README.md',
            source: 'task',
            confidence: 0.9,
          }),
          expect.objectContaining({
            from: 'file:docs/canon/overview.md',
            to: 'canon:char.aria-vale',
            source: 'inferred',
            confidence: 0.5,
          }),
          expect.objectContaining({
            from: 'scene:game/main.tscn',
            to: 'asset:res://assets/aria.png',
            source: 'inferred',
            confidence: 0.6,
          }),
          expect.objectContaining({
            from: `task:${taskId}`,
            to: 'file:game/README.md',
            source: 'tool',
            confidence: 0.7,
          }),
        ]),
      );
      expect(canonRecords[0]?.references[0]?.source).toBe('author');
    } finally {
      database.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('traverses edges bidirectionally with multiplicative confidence and truncates', () => {
    const projectId = uuidv7();
    const node = (nodeId: string): ChangeNode => {
      const [kind, ref] = nodeId.split(':');
      return {
        schemaVersion: 1,
        nodeId,
        projectId,
        kind: kind as ChangeNode['kind'],
        ref: ref!,
        title: ref!,
        lastSeenAt: now,
      };
    };
    const edge = (from: string, to: string, confidence: number): ChangeEdge => ({
      edgeId: uuidv7(),
      projectId,
      from,
      to,
      rel: 'related',
      confidence,
      source: 'inferred',
      evidence: null,
      createdAt: now,
    });
    const nodes = [
      node('canon:char.aria'),
      node('file:docs/aria.md'),
      node('test:tests/aria.test.ts'),
    ];
    const edges = [
      edge(nodes[0]!.nodeId, nodes[1]!.nodeId, 0.8),
      edge(nodes[1]!.nodeId, nodes[2]!.nodeId, 0.5),
    ];
    const impact = calculateImpact(projectId, ['canon:char.aria'], nodes, edges, {
      maxDepth: 4,
      threshold: 0.7,
      now: () => new Date(now),
    });
    expect(
      impact.nodes.find((entry) => entry.node.nodeId === 'test:tests/aria.test.ts'),
    ).toMatchObject({
      depth: 2,
      pathConfidence: 0.4,
      needsValidation: true,
      via: [edges[0]!.edgeId, edges[1]!.edgeId],
    });
    expect(
      calculateImpact(projectId, ['canon:char.aria'], nodes, edges, {
        maxDepth: 1,
        threshold: 0.7,
        now: () => new Date(now),
      }).truncated,
    ).toBe(true);
  });
});
