import { Static, Type, type TSchema } from '@sinclair/typebox';
import {
  ProjectCloneInputSchema,
  ProjectCreateInputSchema,
  ProjectSummarySchema,
} from '../project/manifest';
import {
  EffectiveSettingSchema,
  SettingDefinitionSchema,
  SettingGroupSchema,
  SettingsScope,
} from '../settings/schema';
import {
  TaskCreateInputSchema,
  TaskEventSchema,
  TaskQuestionSchema,
  TaskRecordSchema,
  TaskStateSchema,
} from '../tasks';
import {
  AccessModeSchema,
  ApprovalRequestSchema,
  ToolCallRecordSchema,
  ToolDefinitionSchema,
} from '../tools';
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ModelPoolSchema,
  ModelPoolTargetSchema,
  ModelPricingSchema,
  ModelSchema,
  ModelUsageSchema,
  ProviderAccountSchema,
  ProviderKindSchema,
  RouteDecisionSchema,
  RouteOutcomeSchema,
  RouteRequestSchema,
} from '../models';

export const PROTOCOL_VERSION = 1;

const EmptyParams = Type.Object({}, { additionalProperties: false });
const ServiceInfoSchema = Type.Object(
  {
    serviceVersion: Type.String(),
    protocolVersion: Type.Integer(),
    pid: Type.Integer(),
    profileDir: Type.String(),
    startedAt: Type.String(),
    projectCount: Type.Integer(),
  },
  { additionalProperties: false },
);

export type ServiceInfo = Static<typeof ServiceInfoSchema>;

const ModelCompleteCommonFields = {
  request: ChatRequestSchema,
  projectId: Type.Optional(Type.String({ format: 'uuid' })),
  taskId: Type.Optional(Type.String({ format: 'uuid' })),
  requestId: Type.Optional(Type.String()),
};

export const ModelCompleteParamsSchema = Type.Union([
  Type.Object(
    { ...ModelCompleteCommonFields, modelId: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...ModelCompleteCommonFields, route: RouteRequestSchema },
    { additionalProperties: false },
  ),
]);

export const RpcMethods = {
  'session/hello': {
    params: Type.Object(
      {
        token: Type.String(),
        clientName: Type.String(),
        clientVersion: Type.String(),
        protocolVersion: Type.Integer(),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        ok: Type.Literal(true),
        serviceVersion: Type.String(),
        protocolVersion: Type.Integer(),
        sessionId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
  },
  'service/info': { params: EmptyParams, result: ServiceInfoSchema },
  'project/create': { params: ProjectCreateInputSchema, result: ProjectSummarySchema },
  'project/clone': { params: ProjectCloneInputSchema, result: ProjectSummarySchema },
  'project/list': {
    params: EmptyParams,
    result: Type.Object(
      { projects: Type.Array(ProjectSummarySchema) },
      { additionalProperties: false },
    ),
  },
  'project/open': {
    params: Type.Object({ path: Type.String() }, { additionalProperties: false }),
    result: ProjectSummarySchema,
  },
  'project/get': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: ProjectSummarySchema,
  },
  'settings/describe': {
    params: EmptyParams,
    result: Type.Object(
      { groups: Type.Array(SettingGroupSchema), definitions: Type.Array(SettingDefinitionSchema) },
      { additionalProperties: false },
    ),
  },
  'settings/get': {
    params: Type.Object(
      {
        key: Type.String(),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: EffectiveSettingSchema,
  },
  'settings/getAll': {
    params: Type.Object(
      {
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { settings: Type.Array(EffectiveSettingSchema) },
      { additionalProperties: false },
    ),
  },
  'settings/set': {
    params: Type.Object(
      {
        key: Type.String(),
        scope: SettingsScope,
        value: Type.Unknown(),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: EffectiveSettingSchema,
  },
  'task/create': {
    params: TaskCreateInputSchema,
    result: Type.Object(
      { task: TaskRecordSchema, deduplicated: Type.Boolean() },
      { additionalProperties: false },
    ),
  },
  'task/get': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: TaskRecordSchema,
  },
  'task/list': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        states: Type.Optional(Type.Array(TaskStateSchema)),
        parentTaskId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
        rootTaskId: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 200 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ tasks: Type.Array(TaskRecordSchema) }, { additionalProperties: false }),
  },
  'task/tree': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        rootTaskId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ tasks: Type.Array(TaskRecordSchema) }, { additionalProperties: false }),
  },
  'task/cancel': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.String({ format: 'uuid' }),
        reason: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { cancelled: Type.Array(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
  },
  'task/events': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        afterSeq: Type.Optional(Type.Integer({ minimum: 0 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 500 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ events: Type.Array(TaskEventSchema) }, { additionalProperties: false }),
  },
  'task/answer': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.String({ format: 'uuid' }),
        questionId: Type.String({ format: 'uuid' }),
        answer: Type.Unknown(),
      },
      { additionalProperties: false },
    ),
    result: TaskRecordSchema,
  },
  'task/questions': {
    params: Type.Object(
      { pendingOnly: Type.Optional(Type.Boolean()) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { questions: Type.Array(TaskQuestionSchema) },
      { additionalProperties: false },
    ),
  },
  'service/stop': {
    params: Type.Object({ checkpoint: Type.Boolean() }, { additionalProperties: false }),
    result: Type.Object({ ok: Type.Literal(true) }, { additionalProperties: false }),
  },
  'tool/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { tools: Type.Array(ToolDefinitionSchema) },
      { additionalProperties: false },
    ),
  },
  'tool/call': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        toolId: Type.String({ pattern: '^[a-z0-9-]+/[a-z0-9-]+$' }),
        input: Type.Unknown(),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        agentId: Type.Optional(Type.String()),
        accessCeiling: Type.Optional(AccessModeSchema),
      },
      { additionalProperties: false },
    ),
    result: ToolCallRecordSchema,
  },
  'tool/calls': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        toolId: Type.Optional(Type.String({ pattern: '^[a-z0-9-]+/[a-z0-9-]+$' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 200 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { calls: Type.Array(ToolCallRecordSchema) },
      { additionalProperties: false },
    ),
  },
  'broker/approvals': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        pendingOnly: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { approvals: Type.Array(ApprovalRequestSchema) },
      { additionalProperties: false },
    ),
  },
  'broker/approve': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        approvalId: Type.String({ format: 'uuid' }),
        approve: Type.Boolean(),
        reason: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: ApprovalRequestSchema,
  },
  'provider/accounts': {
    params: EmptyParams,
    result: Type.Object(
      { accounts: Type.Array(ProviderAccountSchema) },
      { additionalProperties: false },
    ),
  },
  'provider/addAccount': {
    params: Type.Object(
      {
        providerKind: ProviderKindSchema,
        displayName: Type.String(),
        baseUrl: Type.String({ format: 'uri' }),
        apiKey: Type.Optional(Type.String()),
        headers: Type.Optional(Type.Record(Type.String(), Type.String())),
        isLocal: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: ProviderAccountSchema,
  },
  'provider/updateAccount': {
    params: Type.Object(
      {
        accountId: Type.String({ format: 'uuid' }),
        patch: Type.Object(
          {
            displayName: Type.Optional(Type.String()),
            baseUrl: Type.Optional(Type.String({ format: 'uri' })),
            apiKey: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            headers: Type.Optional(Type.Record(Type.String(), Type.String())),
            enabled: Type.Optional(Type.Boolean()),
            isLocal: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: ProviderAccountSchema,
  },
  'provider/removeAccount': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'provider/testAccount': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        ok: Type.Boolean(),
        latencyMs: Type.Integer({ minimum: 0 }),
        discoveredModels: Type.Integer({ minimum: 0 }),
        error: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  'model/list': {
    params: Type.Object(
      {
        accountId: Type.Optional(Type.String({ format: 'uuid' })),
        enabledOnly: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ models: Type.Array(ModelSchema) }, { additionalProperties: false }),
  },
  'model/discover': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        added: Type.Integer({ minimum: 0 }),
        updated: Type.Integer({ minimum: 0 }),
        models: Type.Array(ModelSchema),
      },
      { additionalProperties: false },
    ),
  },
  'model/update': {
    params: Type.Object(
      {
        modelId: Type.String(),
        patch: Type.Object(
          {
            enabled: Type.Optional(Type.Boolean()),
            displayName: Type.Optional(Type.String()),
            capabilities: Type.Optional(
              Type.Object(
                {
                  chat: Type.Optional(Type.Boolean()),
                  tools: Type.Optional(Type.Boolean()),
                  vision: Type.Optional(Type.Boolean()),
                  structuredOutput: Type.Optional(Type.Boolean()),
                  streaming: Type.Optional(Type.Boolean()),
                  embeddings: Type.Optional(Type.Boolean()),
                  contextWindow: Type.Optional(
                    Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
                  ),
                  maxOutputTokens: Type.Optional(
                    Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
                  ),
                },
                { additionalProperties: false },
              ),
            ),
            pricing: Type.Optional(ModelPricingSchema),
            tags: Type.Optional(Type.Array(Type.String())),
            workTypes: Type.Optional(Type.Array(Type.String())),
            roles: Type.Optional(Type.Array(Type.String())),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: ModelSchema,
  },
  'pool/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object({ pools: Type.Array(ModelPoolSchema) }, { additionalProperties: false }),
  },
  'pool/create': {
    params: Type.Object(
      {
        name: Type.String(),
        scope: Type.Union([Type.Literal('platform'), Type.Literal('project')]),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        target: Type.Union([ModelPoolTargetSchema, Type.Null()]),
        modelIds: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: ModelPoolSchema,
  },
  'pool/update': {
    params: Type.Object(
      {
        poolId: Type.String({ format: 'uuid' }),
        patch: Type.Object(
          {
            name: Type.Optional(Type.String()),
            scope: Type.Optional(Type.Union([Type.Literal('platform'), Type.Literal('project')])),
            projectId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
            target: Type.Optional(Type.Union([ModelPoolTargetSchema, Type.Null()])),
            modelIds: Type.Optional(Type.Array(Type.String())),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: ModelPoolSchema,
  },
  'pool/delete': {
    params: Type.Object(
      { poolId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'router/route': { params: RouteRequestSchema, result: RouteDecisionSchema },
  'router/reportOutcome': {
    params: RouteOutcomeSchema,
    result: Type.Object({ recorded: Type.Literal(true) }, { additionalProperties: false }),
  },
  'router/decisions': {
    params: Type.Object(
      {
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 200 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        decisions: Type.Array(
          Type.Object(
            {
              decision: RouteDecisionSchema,
              outcome: Type.Union([RouteOutcomeSchema, Type.Null()]),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  },
  'router/stats': {
    params: Type.Object(
      { taskType: Type.Optional(Type.String()) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        models: Type.Array(
          Type.Object(
            {
              modelId: Type.String(),
              taskType: Type.Union([Type.String(), Type.Null()]),
              observations: Type.Integer({ minimum: 0 }),
              successRate: Type.Number({ minimum: 0, maximum: 1 }),
              qualityMean: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]),
              meanCostUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
              meanLatencyMs: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  },
  'model/complete': {
    params: ModelCompleteParamsSchema,
    result: ChatResponseSchema,
  },
  'model/embed': {
    params: Type.Object(
      {
        modelId: Type.String(),
        inputs: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { vectors: Type.Array(Type.Array(Type.Number())), usage: ModelUsageSchema },
      { additionalProperties: false },
    ),
  },
} as const satisfies Record<string, { params: TSchema; result: TSchema }>;

export const RpcNotifications = {
  'project/changed': {
    params: Type.Object(
      {
        kind: Type.Union([
          Type.Literal('created'),
          Type.Literal('cloned'),
          Type.Literal('opened'),
          Type.Literal('removed'),
        ]),
        project: ProjectSummarySchema,
      },
      { additionalProperties: false },
    ),
  },
  'settings/changed': {
    params: Type.Object(
      {
        key: Type.String(),
        scope: SettingsScope,
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
  },
  'task/changed': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        task: TaskRecordSchema,
      },
      { additionalProperties: false },
    ),
  },
  'task/event': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        event: TaskEventSchema,
      },
      { additionalProperties: false },
    ),
  },
  'task/question': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        question: TaskQuestionSchema,
      },
      { additionalProperties: false },
    ),
  },
  'broker/approvalRequested': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        approval: ApprovalRequestSchema,
      },
      { additionalProperties: false },
    ),
  },
  'broker/approvalResolved': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        approval: ApprovalRequestSchema,
      },
      { additionalProperties: false },
    ),
  },
  'tool/called': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        call: ToolCallRecordSchema,
      },
      { additionalProperties: false },
    ),
  },
  'model/delta': {
    params: Type.Object(
      { requestId: Type.String(), delta: Type.String() },
      { additionalProperties: false },
    ),
  },
} as const satisfies Record<string, { params: TSchema }>;

export type RpcMethodName = keyof typeof RpcMethods;
export type RpcParams<M extends RpcMethodName> = Static<(typeof RpcMethods)[M]['params']>;
export type RpcResult<M extends RpcMethodName> = Static<(typeof RpcMethods)[M]['result']>;
export type RpcNotificationName = keyof typeof RpcNotifications;
export type RpcNotificationParams<N extends RpcNotificationName> = Static<
  (typeof RpcNotifications)[N]['params']
>;

export const RpcErrorCode = {
  Unauthenticated: -32000,
  InvalidProjectFolder: -32001,
  EngineLocked: -32002,
  ProjectAlreadyExists: -32003,
  ProjectNotFound: -32004,
  ProtocolVersionMismatch: -32005,
  UnknownSetting: -32010,
  InvalidSettingValue: -32011,
  SettingScopeNotAllowed: -32012,
  UnknownSession: -32013,
  TaskNotFound: -32020,
  TaskDepthExceeded: -32021,
  InvalidTaskTransition: -32022,
  TaskDependencyCycle: -32023,
  UnknownTaskKind: -32024,
  QuestionNotFound: -32025,
  TaskNotWaiting: -32026,
  ToolNotFound: -32030,
  ToolDenied: -32031,
  ToolInputInvalid: -32032,
  ApprovalNotFound: -32033,
  PathOutsideProject: -32034,
  ApprovalAlreadyResolved: -32035,
  AccountNotFound: -32040,
  ModelNotFound: -32041,
  NoEligibleModel: -32042,
  ProviderRequestFailed: -32043,
  PoolNotFound: -32044,
  DecisionNotFound: -32045,
  ProviderUnsupportedFeature: -32046,
  InvalidParams: -32602,
} as const;
export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: RpcErrorCode,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}
