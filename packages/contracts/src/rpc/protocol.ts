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
