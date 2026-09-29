import { Static, Type } from '@sinclair/typebox';

export const BoardThreadKindSchema = Type.Union([
  Type.Literal('discussion'),
  Type.Literal('question'),
  Type.Literal('proposal'),
  Type.Literal('decision'),
  Type.Literal('blocker'),
  Type.Literal('status'),
]);
export type BoardThreadKind = Static<typeof BoardThreadKindSchema>;

export const BoardThreadStatusSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('resolved'),
  Type.Literal('archived'),
]);
export type BoardThreadStatus = Static<typeof BoardThreadStatusSchema>;

export const BoardMessageTypeSchema = Type.Union([
  Type.Literal('question'),
  Type.Literal('proposal'),
  Type.Literal('finding'),
  Type.Literal('blocker'),
  Type.Literal('evidence'),
  Type.Literal('decision'),
  Type.Literal('comment'),
  Type.Literal('summary'),
  Type.Literal('system'),
]);
export type BoardMessageType = Static<typeof BoardMessageTypeSchema>;

export const BoardLinkKindSchema = Type.Union([
  Type.Literal('task'),
  Type.Literal('artifact'),
  Type.Literal('canon'),
  Type.Literal('module'),
  Type.Literal('thread'),
]);
export type BoardLinkKind = Static<typeof BoardLinkKindSchema>;

export const BoardLinkSchema = Type.Object(
  { kind: BoardLinkKindSchema, ref: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
export type BoardLink = Static<typeof BoardLinkSchema>;

export const BoardUserAuthorSchema = Type.Object(
  { kind: Type.Literal('user') },
  { additionalProperties: false },
);
export type BoardUserAuthor = Static<typeof BoardUserAuthorSchema>;

export const BoardAuthorSchema = Type.Union([
  BoardUserAuthorSchema,
  Type.Object(
    {
      kind: Type.Literal('agent'),
      role: Type.String({ minLength: 1 }),
      taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal('system') }, { additionalProperties: false }),
]);
export type BoardAuthor = Static<typeof BoardAuthorSchema>;

export const BoardThreadSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    threadId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    title: Type.String({ minLength: 1 }),
    kind: BoardThreadKindSchema,
    status: BoardThreadStatusSchema,
    tags: Type.Array(Type.String()),
    links: Type.Array(BoardLinkSchema),
    createdBy: BoardAuthorSchema,
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    lastMessageAt: Type.String({ format: 'date-time' }),
    messageCount: Type.Integer({ minimum: 0 }),
    summary: Type.Union([Type.String(), Type.Null()]),
    summaryUpdatedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    archivedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BoardThread = Static<typeof BoardThreadSchema>;

export const BoardMessageEditSchema = Type.Object(
  {
    editedAt: Type.String({ format: 'date-time' }),
    previousBody: Type.String(),
  },
  { additionalProperties: false },
);

export const BoardMessageSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    messageId: Type.String({ format: 'uuid' }),
    threadId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    seq: Type.Integer({ minimum: 1 }),
    type: BoardMessageTypeSchema,
    body: Type.String({ minLength: 1 }),
    author: BoardAuthorSchema,
    links: Type.Array(BoardLinkSchema),
    replyTo: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    supersededBy: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    editHistory: Type.Array(BoardMessageEditSchema),
  },
  { additionalProperties: false },
);
export type BoardMessage = Static<typeof BoardMessageSchema>;

export const BindingDecisionSyncStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('synchronizing'),
  Type.Literal('synchronized'),
  Type.Literal('failed'),
  Type.Literal('conflict'),
]);
export type BindingDecisionSyncStatus = Static<typeof BindingDecisionSyncStatusSchema>;

export const BindingDecisionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    decisionId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    threadId: Type.String({ format: 'uuid' }),
    messageId: Type.String({ format: 'uuid' }),
    title: Type.String({ minLength: 1 }),
    statement: Type.String({ minLength: 1 }),
    rationale: Type.Union([Type.String(), Type.Null()]),
    madeBy: BoardUserAuthorSchema,
    boundAt: Type.String({ format: 'date-time' }),
    supersedes: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    syncStatus: BindingDecisionSyncStatusSchema,
    syncAttempts: Type.Integer({ minimum: 0 }),
    lastSyncError: Type.Union([Type.String(), Type.Null()]),
    syncedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    canonRecordPath: Type.Union([Type.String(), Type.Null()]),
    canonCommit: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BindingDecision = Static<typeof BindingDecisionSchema>;

export const BoardSubscriptionSubscriberSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal('agent'), role: Type.String({ minLength: 1 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('task'), taskId: Type.String({ format: 'uuid' }) },
    { additionalProperties: false },
  ),
  BoardUserAuthorSchema,
]);
export type BoardSubscriptionSubscriber = Static<typeof BoardSubscriptionSubscriberSchema>;

export const BoardSubscriptionFilterSchema = Type.Object(
  {
    threadIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
    tags: Type.Optional(Type.Array(Type.String())),
    kinds: Type.Optional(Type.Array(BoardThreadKindSchema)),
    messageTypes: Type.Optional(Type.Array(BoardMessageTypeSchema)),
  },
  { additionalProperties: false },
);
export type BoardSubscriptionFilter = Static<typeof BoardSubscriptionFilterSchema>;

export const BoardSubscriptionSchema = Type.Object(
  {
    subscriptionId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    subscriber: BoardSubscriptionSubscriberSchema,
    filter: BoardSubscriptionFilterSchema,
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type BoardSubscription = Static<typeof BoardSubscriptionSchema>;

export const CanonSyncProposalSchema = Type.Object(
  {
    proposalId: Type.String({ format: 'uuid' }),
    decisionId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    path: Type.String({ minLength: 1 }),
    before: Type.Union([Type.String(), Type.Null()]),
    after: Type.String(),
    diff: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    appliedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    commit: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type CanonSyncProposal = Static<typeof CanonSyncProposalSchema>;

export const BoardMaintenanceVerdictSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1 }),
    decisionsWithoutBinding: Type.Array(Type.String({ format: 'uuid' })),
    staleBlockers: Type.Array(Type.String({ format: 'uuid' })),
    driftAgainstCanon: Type.Array(
      Type.Object(
        {
          decisionId: Type.String({ format: 'uuid' }),
          canonPath: Type.String({ minLength: 1 }),
          note: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type BoardMaintenanceVerdict = Static<typeof BoardMaintenanceVerdictSchema>;

export const BoardMaintenanceStatusSchema = Type.Object(
  {
    lastAuditAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    lastCleanupAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    nextAuditAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    pendingDecisions: Type.Integer({ minimum: 0 }),
    runningTaskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BoardMaintenanceStatus = Static<typeof BoardMaintenanceStatusSchema>;
