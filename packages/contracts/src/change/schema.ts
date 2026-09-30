import { Static, Type } from '@sinclair/typebox';

export const ChangeNodeKindSchema = Type.Union([
  Type.Literal('canon'),
  Type.Literal('file'),
  Type.Literal('code-symbol'),
  Type.Literal('scene'),
  Type.Literal('asset'),
  Type.Literal('test'),
  Type.Literal('task'),
  Type.Literal('decision'),
  Type.Literal('thread'),
  Type.Literal('engine-session'),
  Type.Literal('dcc-session'),
]);
export type ChangeNodeKind = Static<typeof ChangeNodeKindSchema>;

export const ChangeNodeRefSchema = Type.String({
  pattern:
    '^(canon|file|code-symbol|scene|asset|test|task|decision|thread|engine-session|dcc-session):.+$',
});
export type ChangeNodeRef = Static<typeof ChangeNodeRefSchema>;

export const ChangeNodeSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    nodeId: ChangeNodeRefSchema,
    projectId: Type.String({ format: 'uuid' }),
    kind: ChangeNodeKindSchema,
    ref: Type.String({ minLength: 1 }),
    title: Type.String(),
    lastSeenAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ChangeNode = Static<typeof ChangeNodeSchema>;

export const ChangeEdgeSchema = Type.Object(
  {
    edgeId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    from: ChangeNodeRefSchema,
    to: ChangeNodeRefSchema,
    rel: Type.String({ minLength: 1 }),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    source: Type.Union([
      Type.Literal('author'),
      Type.Literal('inferred'),
      Type.Literal('decision'),
      Type.Literal('tool'),
      Type.Literal('task'),
    ]),
    evidence: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ChangeEdge = Static<typeof ChangeEdgeSchema>;

export const ImpactNodeSchema = Type.Object(
  {
    node: ChangeNodeSchema,
    depth: Type.Integer({ minimum: 0 }),
    pathConfidence: Type.Number({ minimum: 0, maximum: 1 }),
    via: Type.Array(Type.String({ format: 'uuid' })),
    needsValidation: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type ImpactNode = Static<typeof ImpactNodeSchema>;

export const ImpactResultSchema = Type.Object(
  {
    seeds: Type.Array(ChangeNodeRefSchema),
    threshold: Type.Number({ minimum: 0, maximum: 1 }),
    nodes: Type.Array(ImpactNodeSchema),
    truncated: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type ImpactResult = Static<typeof ImpactResultSchema>;

export const ResourceLockSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    lockId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    resource: ChangeNodeRefSchema,
    mode: Type.Union([Type.Literal('shared'), Type.Literal('exclusive')]),
    taskId: Type.String({ format: 'uuid' }),
    workerId: Type.Union([Type.String(), Type.Null()]),
    acquiredAt: Type.String({ format: 'date-time' }),
    expiresAt: Type.String({ format: 'date-time' }),
    renewedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ResourceLock = Static<typeof ResourceLockSchema>;

export const TaskTouchSchema = Type.Object(
  {
    resource: ChangeNodeRefSchema,
    intent: Type.Union([Type.Literal('read'), Type.Literal('write')]),
  },
  { additionalProperties: false },
);
export type TaskTouch = Static<typeof TaskTouchSchema>;

export const CompletionClaimKindSchema = Type.Union([
  Type.Literal('generated'),
  Type.Literal('static-check'),
  Type.Literal('tool-validation'),
  Type.Literal('engine-validation'),
  Type.Literal('user-review'),
  Type.Literal('integration'),
]);
export type CompletionClaimKind = Static<typeof CompletionClaimKindSchema>;

export const CompletionValidatorSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal('engine'), Type.Literal('dcc'), Type.Literal('tool')]),
    operation: Type.Optional(Type.String()),
    toolId: Type.Optional(Type.String()),
    params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);
export type CompletionValidator = Static<typeof CompletionValidatorSchema>;

export const TaskCompletionContractSchema = Type.Object(
  {
    required: Type.Array(CompletionClaimKindSchema),
    validators: Type.Array(CompletionValidatorSchema),
  },
  { additionalProperties: false },
);
export type TaskCompletionContract = Static<typeof TaskCompletionContractSchema>;

export const CompletionClaimSchema = Type.Object(
  {
    summary: Type.String(),
    artifacts: Type.Array(
      Type.Object(
        {
          kind: Type.String(),
          path: Type.Optional(Type.String()),
          uri: Type.Optional(Type.String()),
          hash: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    evidence: Type.Array(
      Type.Object({ kind: Type.String(), ref: Type.String() }, { additionalProperties: false }),
    ),
    claims: Type.Array(
      Type.Object(
        { kind: CompletionClaimKindSchema, ref: Type.String() },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type CompletionClaim = Static<typeof CompletionClaimSchema>;

export const IntegrationConflictSchema = Type.Object(
  {
    file: Type.String(),
    kind: Type.Union([
      Type.Literal('git-conflict'),
      Type.Literal('concurrent-change'),
      Type.Literal('locked-by-other'),
      Type.Literal('declared-overlap'),
    ]),
    otherTaskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type IntegrationConflict = Static<typeof IntegrationConflictSchema>;

export const IntegrationValidationSchema = Type.Object(
  {
    kind: Type.String(),
    ref: Type.String(),
    ok: Type.Boolean(),
    detail: Type.String(),
  },
  { additionalProperties: false },
);
export type IntegrationValidation = Static<typeof IntegrationValidationSchema>;

export const IntegrationStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('validating'),
  Type.Literal('conflict'),
  Type.Literal('ready'),
  Type.Literal('integrated'),
  Type.Literal('rejected'),
  Type.Literal('aborted'),
]);
export type IntegrationStatus = Static<typeof IntegrationStatusSchema>;

export const IntegrationRecordSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    integrationId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    taskId: Type.String({ format: 'uuid' }),
    worktreePath: Type.Union([Type.String(), Type.Null()]),
    branch: Type.Union([Type.String(), Type.Null()]),
    baseCommit: Type.String(),
    status: IntegrationStatusSchema,
    changedFiles: Type.Array(Type.String()),
    conflicts: Type.Array(IntegrationConflictSchema),
    validation: Type.Array(IntegrationValidationSchema),
    mergeCommit: Type.Union([Type.String(), Type.Null()]),
    reconcileTaskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type IntegrationRecord = Static<typeof IntegrationRecordSchema>;

export const ChangeRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    requestId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    text: Type.String(),
    rootTaskId: Type.String({ format: 'uuid' }),
    threadId: Type.String({ format: 'uuid' }),
    impactPreview: Type.Union([ImpactResultSchema, Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ChangeRequest = Static<typeof ChangeRequestSchema>;

export const FeedbackInputSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    target: Type.Object(
      {
        kind: Type.Union([Type.Literal('task'), Type.Literal('artifact'), Type.Literal('thread')]),
        ref: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    decision: Type.Union([Type.Literal('accept'), Type.Literal('revise'), Type.Literal('reject')]),
    note: Type.String(),
  },
  { additionalProperties: false },
);
export type FeedbackInput = Static<typeof FeedbackInputSchema>;
