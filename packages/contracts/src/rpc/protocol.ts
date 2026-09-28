import { Static, Type, type TSchema } from '@sinclair/typebox';
import { ProjectCreateInputSchema, ProjectSummarySchema } from '../project/manifest';

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
      },
      { additionalProperties: false },
    ),
  },
  'service/info': { params: EmptyParams, result: ServiceInfoSchema },
  'project/create': { params: ProjectCreateInputSchema, result: ProjectSummarySchema },
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
} as const satisfies Record<string, { params: TSchema; result: TSchema }>;

export const RpcNotifications = {
  'project/changed': {
    params: Type.Object(
      {
        kind: Type.Union([
          Type.Literal('created'),
          Type.Literal('opened'),
          Type.Literal('removed'),
        ]),
        project: ProjectSummarySchema,
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
