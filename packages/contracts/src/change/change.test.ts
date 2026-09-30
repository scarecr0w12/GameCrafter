import { describe, expect, it } from 'vitest';
import { compile } from '../validation';
import {
  ChangeEdgeSchema,
  ChangeNodeRefSchema,
  ChangeNodeSchema,
  ChangeRequestSchema,
  CompletionClaimSchema,
  FeedbackInputSchema,
  ImpactResultSchema,
  IntegrationRecordSchema,
  ResourceLockSchema,
  RpcErrorCode,
  RpcMethods,
  RpcNotifications,
  TaskCompletionContractSchema,
  TaskCreateInputSchema,
  TaskRecordSchema,
  TaskTouchSchema,
  uuidv7,
} from '..';

describe('change coordination contracts', () => {
  it('accepts every declared node-reference kind and rejects malformed references', () => {
    const schema = compile(ChangeNodeRefSchema);
    for (const kind of [
      'canon',
      'file',
      'code-symbol',
      'scene',
      'asset',
      'test',
      'task',
      'decision',
      'thread',
      'engine-session',
      'dcc-session',
    ]) {
      expect(schema.check(`${kind}:ref`)).toBe(true);
    }
    expect(schema.check('unknown:ref')).toBe(false);
    expect(schema.check('file:')).toBe(false);
    expect(schema.check('no-prefix')).toBe(false);
  });

  it('round-trips nodes, edges, impacts, locks, completion contracts, integrations, requests, and feedback', () => {
    const projectId = uuidv7();
    const taskId = uuidv7();
    const now = new Date().toISOString();
    const node = {
      schemaVersion: 1 as const,
      nodeId: 'canon:char.aria-vale',
      projectId,
      kind: 'canon' as const,
      ref: 'char.aria-vale',
      title: 'Aria Vale',
      lastSeenAt: now,
    };
    const edge = {
      edgeId: uuidv7(),
      projectId,
      from: node.nodeId,
      to: 'file:docs/canon/aria.md',
      rel: 'documented-by',
      confidence: 0.9,
      source: 'author' as const,
      evidence: 'frontmatter reference',
      createdAt: now,
    };
    const contract = {
      required: ['generated', 'static-check'] as const,
      validators: [
        { kind: 'tool' as const, toolId: 'process/run', params: { argv: ['npm', 'test'] } },
      ],
    };
    const values = [
      [ChangeNodeSchema, node],
      [ChangeEdgeSchema, edge],
      [
        ImpactResultSchema,
        {
          seeds: [node.nodeId],
          threshold: 0.7,
          nodes: [
            { node, depth: 1, pathConfidence: 0.9, via: [edge.edgeId], needsValidation: false },
          ],
          truncated: false,
        },
      ],
      [
        ResourceLockSchema,
        {
          schemaVersion: 1,
          lockId: uuidv7(),
          projectId,
          resource: 'file:docs/canon/aria.md',
          mode: 'exclusive',
          taskId,
          workerId: null,
          acquiredAt: now,
          expiresAt: now,
          renewedAt: now,
        },
      ],
      [TaskTouchSchema, { resource: 'file:docs/canon/aria.md', intent: 'write' }],
      [TaskCompletionContractSchema, contract],
      [
        CompletionClaimSchema,
        {
          summary: 'Updated Aria canon',
          artifacts: [{ kind: 'file', path: 'docs/canon/aria.md' }],
          evidence: [{ kind: 'tool', ref: uuidv7() }],
          claims: [{ kind: 'static-check', ref: uuidv7() }],
        },
      ],
      [
        IntegrationRecordSchema,
        {
          schemaVersion: 1,
          integrationId: uuidv7(),
          projectId,
          taskId,
          worktreePath: null,
          branch: null,
          baseCommit: 'a'.repeat(40),
          status: 'pending',
          changedFiles: [],
          conflicts: [],
          validation: [],
          mergeCommit: null,
          reconcileTaskId: null,
          updatedAt: now,
        },
      ],
      [
        ChangeRequestSchema,
        {
          schemaVersion: 1,
          requestId: uuidv7(),
          projectId,
          text: "Revise Aria's harbor rescue history",
          rootTaskId: taskId,
          threadId: uuidv7(),
          impactPreview: null,
          createdAt: now,
        },
      ],
      [
        FeedbackInputSchema,
        {
          projectId,
          target: { kind: 'task', ref: taskId },
          decision: 'revise',
          note: 'Preserve the established harbor timeline.',
        },
      ],
    ] as const;
    for (const [schema, value] of values) {
      expect(compile(schema).assert(value)).toEqual(value);
    }
  });

  it('keeps WP18 TaskRecord fields optional under schema v1', () => {
    const now = new Date().toISOString();
    const task = {
      schemaVersion: 1 as const,
      taskId: uuidv7(),
      projectId: uuidv7(),
      parentTaskId: null,
      rootTaskId: uuidv7(),
      depth: 0,
      kind: 'noop.echo',
      title: 'Old task',
      goal: 'Existing v1 task',
      goalHash: 'a'.repeat(64),
      state: 'ready' as const,
      priority: 50,
      dependsOn: [],
      assignee: null,
      budget: {},
      spent: { costUsd: 0, tokens: 0 },
      attempt: 1,
      maxAttempts: 3,
      lease: null,
      input: {},
      checkpoint: null,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    expect(compile(TaskRecordSchema).assert(task)).toEqual(task);
    expect(
      compile(TaskRecordSchema).assert({
        ...task,
        touches: [{ resource: 'file:game/README.md', intent: 'write' }],
        role: 'programmer',
        isolation: 'worktree',
        contract: { required: ['static-check'], validators: [] },
        integration: null,
      }),
    ).toMatchObject({ schemaVersion: 1, role: 'programmer', isolation: 'worktree' });
    expect(
      compile(TaskCreateInputSchema).check({
        projectId: task.projectId,
        kind: 'agent.run',
        title: 'Implement request',
        goal: 'Implement request',
        touches: [{ resource: 'file:game/README.md', intent: 'write' }],
        role: 'programmer',
        isolation: 'worktree',
        contract: { required: ['static-check'], validators: [] },
      }),
    ).toBe(true);
  });

  it('registers unique coordination errors and RPC/notification names', () => {
    const codes = Object.values(RpcErrorCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of [
      'LockConflict',
      'LockNotHeld',
      'IntegrationConflict',
      'IntegrationNotReady',
      'CompletionContractUnmet',
      'WorktreeUnavailable',
      'RoleToolDenied',
      'AgentBudgetExceeded',
      'AgentTurnLimit',
    ] as const) {
      expect(RpcErrorCode).toHaveProperty(code);
    }
    for (const method of [
      'change/request',
      'change/requests',
      'change/impact',
      'change/graph',
      'change/rebuildGraph',
      'change/locks',
      'change/releaseLock',
      'change/integrations',
      'change/integrate',
      'change/abortIntegration',
      'change/feedback',
    ]) {
      expect(RpcMethods).toHaveProperty(method);
    }
    for (const notification of [
      'change/lockChanged',
      'change/integrationChanged',
      'change/requestChanged',
    ]) {
      expect(RpcNotifications).toHaveProperty(notification);
    }
  });
});
