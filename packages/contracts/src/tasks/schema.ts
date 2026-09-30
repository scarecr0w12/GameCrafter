import { createHash } from 'node:crypto';
import { Static, Type } from '@sinclair/typebox';
import {
  CompletionClaimKindSchema,
  IntegrationRecordSchema,
  TaskCompletionContractSchema,
  TaskTouchSchema,
} from '../change';
import { AccessModeSchema } from '../tools/schema';

export const TaskStateSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('ready'),
  Type.Literal('claimed'),
  Type.Literal('running'),
  Type.Literal('waiting_input'),
  Type.Literal('blocked'),
  Type.Literal('succeeded'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
]);
export type TaskState = Static<typeof TaskStateSchema>;

export const TASK_TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending: ['ready', 'blocked', 'cancelled'],
  ready: ['claimed', 'blocked', 'cancelled'],
  claimed: ['running', 'ready', 'cancelled'],
  running: ['waiting_input', 'succeeded', 'failed', 'ready', 'cancelled'],
  waiting_input: ['running', 'cancelled'],
  blocked: ['ready', 'cancelled'],
  succeeded: [],
  failed: ['ready'],
  cancelled: [],
};

const terminalStates = new Set<TaskState>(['succeeded', 'failed', 'cancelled']);

export function isTerminal(state: TaskState): boolean {
  return terminalStates.has(state);
}

export function computeGoalHash(kind: string, goal: string): string {
  const normalizedGoal = goal.toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${kind}\n${normalizedGoal}`).digest('hex');
}

export const TaskAssigneeSchema = Type.Object(
  {
    role: Type.Optional(Type.String()),
    agentId: Type.Optional(Type.String()),
    accessCeiling: Type.Optional(AccessModeSchema),
  },
  { additionalProperties: false },
);
export type TaskAssignee = Static<typeof TaskAssigneeSchema>;

export const TaskBudgetSchema = Type.Object(
  {
    maxCostUsd: Type.Optional(Type.Number({ minimum: 0 })),
    maxTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    maxDurationMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);
export type TaskBudget = Static<typeof TaskBudgetSchema>;

export const TaskSpentSchema = Type.Object(
  {
    costUsd: Type.Number({ minimum: 0 }),
    tokens: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type TaskSpent = Static<typeof TaskSpentSchema>;

export const TaskLeaseSchema = Type.Object(
  {
    workerId: Type.String(),
    expiresAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type TaskLease = Static<typeof TaskLeaseSchema>;

export const TaskArtifactSchema = Type.Object(
  {
    kind: Type.String(),
    path: Type.Optional(Type.String()),
    uri: Type.Optional(Type.String()),
    hash: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type TaskArtifact = Static<typeof TaskArtifactSchema>;

export const TaskEvidenceSchema = Type.Object(
  {
    kind: Type.String(),
    ref: Type.String(),
  },
  { additionalProperties: false },
);
export type TaskEvidence = Static<typeof TaskEvidenceSchema>;

export const TaskResultSchema = Type.Object(
  {
    summary: Type.String(),
    artifacts: Type.Array(TaskArtifactSchema),
    evidence: Type.Array(TaskEvidenceSchema),
    reviewStatus: Type.Optional(
      Type.Union([
        Type.Literal('accepted'),
        Type.Literal('revision-requested'),
        Type.Literal('rejected'),
      ]),
    ),
    claims: Type.Optional(
      Type.Array(
        Type.Object(
          { kind: CompletionClaimKindSchema, ref: Type.String() },
          { additionalProperties: false },
        ),
      ),
    ),
  },
  { additionalProperties: false },
);
export type TaskResult = Static<typeof TaskResultSchema>;

export const TaskErrorSchema = Type.Object(
  {
    message: Type.String(),
    code: Type.Optional(Type.String()),
    retryable: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type TaskError = Static<typeof TaskErrorSchema>;

const NullableUuid = Type.Union([Type.String({ format: 'uuid' }), Type.Null()]);

// Coordination metadata stays optional so persisted schemaVersion 1 tasks remain compatible.
export const TaskRecordSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    taskId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    parentTaskId: NullableUuid,
    rootTaskId: Type.String({ format: 'uuid' }),
    depth: Type.Integer({ minimum: 0 }),
    kind: Type.String(),
    title: Type.String(),
    goal: Type.String(),
    goalHash: Type.String(),
    state: TaskStateSchema,
    priority: Type.Integer({ minimum: 0, maximum: 100, default: 50 }),
    dependsOn: Type.Array(Type.String({ format: 'uuid' })),
    assignee: Type.Union([TaskAssigneeSchema, Type.Null()]),
    touches: Type.Optional(Type.Array(TaskTouchSchema)),
    role: Type.Optional(Type.String()),
    isolation: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('worktree')])),
    contract: Type.Optional(TaskCompletionContractSchema),
    integration: Type.Optional(Type.Union([IntegrationRecordSchema, Type.Null()])),
    budget: TaskBudgetSchema,
    spent: TaskSpentSchema,
    attempt: Type.Integer({ minimum: 1 }),
    maxAttempts: Type.Integer({ minimum: 1 }),
    lease: Type.Union([TaskLeaseSchema, Type.Null()]),
    input: Type.Unknown(),
    checkpoint: Type.Unknown(),
    result: Type.Union([TaskResultSchema, Type.Null()]),
    error: Type.Union([TaskErrorSchema, Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    startedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    finishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type TaskRecord = Static<typeof TaskRecordSchema>;

export const TaskCreateInputSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    kind: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    goal: Type.String(),
    parentTaskId: Type.Optional(Type.String({ format: 'uuid' })),
    dependsOn: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
    priority: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    budget: Type.Optional(TaskBudgetSchema),
    maxAttempts: Type.Optional(Type.Integer({ minimum: 1 })),
    assignee: Type.Optional(TaskAssigneeSchema),
    touches: Type.Optional(Type.Array(TaskTouchSchema)),
    role: Type.Optional(Type.String()),
    isolation: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('worktree')])),
    contract: Type.Optional(TaskCompletionContractSchema),
    integration: Type.Optional(Type.Union([IntegrationRecordSchema, Type.Null()])),
    input: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);
export type TaskCreateInput = Static<typeof TaskCreateInputSchema>;

export const TaskEventKind = {
  Created: 'task.created',
  StateChanged: 'task.state_changed',
  Claimed: 'task.claimed',
  Progress: 'task.progress',
  Checkpoint: 'task.checkpoint',
  Question: 'task.question',
  Answer: 'task.answer',
  Result: 'task.result',
  Failed: 'task.failed',
  Retry: 'task.retry',
  Cancelled: 'task.cancelled',
  Feedback: 'task.feedback',
} as const;
export type TaskEventKind = (typeof TaskEventKind)[keyof typeof TaskEventKind];

export const TaskEventSchema = Type.Object(
  {
    eventId: Type.String({ format: 'uuid' }),
    seq: Type.Integer({ minimum: 1 }),
    taskId: NullableUuid,
    kind: Type.String(),
    occurredAt: Type.String({ format: 'date-time' }),
    actor: Type.String(),
    payload: Type.Unknown(),
  },
  { additionalProperties: false },
);
export type TaskEvent = Static<typeof TaskEventSchema>;

export const TaskQuestionSchema = Type.Object(
  {
    questionId: Type.String({ format: 'uuid' }),
    taskId: Type.String({ format: 'uuid' }),
    prompt: Type.String(),
    options: Type.Union([Type.Array(Type.String()), Type.Null()]),
    askedAt: Type.String({ format: 'date-time' }),
    answer: Type.Unknown(),
    answeredAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type TaskQuestion = Static<typeof TaskQuestionSchema>;
