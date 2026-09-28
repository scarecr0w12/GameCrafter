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
