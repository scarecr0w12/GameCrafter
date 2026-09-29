import { Static, Type } from '@sinclair/typebox';
import { AccessModeSchema } from '../tools';
import { ToolDefinitionSchema } from '../tools';

export const MCP_SUPPORTED_REVISIONS = [
  '2026-07-28',
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
] as const;

export const McpRevisionSchema = Type.Union([
  Type.Literal('2025-03-26'),
  Type.Literal('2025-06-18'),
  Type.Literal('2025-11-25'),
  Type.Literal('2026-07-28'),
]);
export type McpRevision = Static<typeof McpRevisionSchema>;

export const McpConnectionScopeSchema = Type.Union([
  Type.Literal('platform'),
  Type.Literal('project'),
]);

export const McpConnectionModeSchema = Type.Union([
  Type.Literal('command'),
  Type.Literal('endpoint'),
  Type.Literal('docker'),
]);

const McpConnectionCommandSchema = Type.Object(
  {
    command: Type.String({ minLength: 1 }),
    args: Type.Array(Type.String()),
    cwd: Type.Optional(Type.String()),
    env: Type.Record(Type.String(), Type.String()),
  },
  { additionalProperties: false },
);

const McpConnectionEndpointSchema = Type.Object(
  {
    url: Type.String({ format: 'uri' }),
    transport: Type.Union([Type.Literal('streamable-http'), Type.Literal('legacy-sse')]),
    headers: Type.Record(Type.String(), Type.String()),
  },
  { additionalProperties: false },
);

const McpConnectionMountSchema = Type.Object(
  {
    source: Type.String({ minLength: 1 }),
    target: Type.String({ minLength: 1 }),
    readOnly: Type.Boolean(),
  },
  { additionalProperties: false },
);

const McpConnectionDockerSchema = Type.Object(
  {
    image: Type.String({ minLength: 1 }),
    command: Type.Array(Type.String()),
    transport: Type.Union([Type.Literal('stdio'), Type.Literal('streamable-http')]),
    port: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
    mounts: Type.Array(McpConnectionMountSchema),
    env: Type.Record(Type.String(), Type.String()),
    network: Type.Union([Type.Literal('none'), Type.Literal('bridge'), Type.Literal('host')]),
    pullPolicy: Type.Union([
      Type.Literal('if-missing'),
      Type.Literal('always'),
      Type.Literal('never'),
    ]),
    stopOnDisconnect: Type.Boolean(),
  },
  { additionalProperties: false },
);

const McpTimeoutsSchema = Type.Object(
  {
    connect: Type.Integer({ minimum: 1 }),
    request: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

const McpConnectionStoredFields = {
  connectionId: Type.String({ format: 'uuid' }),
  name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
  scope: McpConnectionScopeSchema,
  projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  allowServerInitiatedModelCalls: Type.Boolean(),
  enabled: Type.Boolean(),
  timeoutsMs: McpTimeoutsSchema,
  tags: Type.Array(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
};

export const McpConnectionConfigSchema = Type.Union([
  Type.Object(
    {
      ...McpConnectionStoredFields,
      mode: Type.Literal('command'),
      command: McpConnectionCommandSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...McpConnectionStoredFields,
      mode: Type.Literal('endpoint'),
      endpoint: McpConnectionEndpointSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...McpConnectionStoredFields,
      mode: Type.Literal('docker'),
      docker: McpConnectionDockerSchema,
    },
    { additionalProperties: false },
  ),
]);
export type McpConnectionConfig = Static<typeof McpConnectionConfigSchema>;

const McpConnectionInputFields = {
  name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
  scope: McpConnectionScopeSchema,
  projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  allowServerInitiatedModelCalls: Type.Optional(Type.Boolean()),
  enabled: Type.Optional(Type.Boolean()),
  timeoutsMs: Type.Optional(Type.Partial(McpTimeoutsSchema, { additionalProperties: false })),
  tags: Type.Optional(Type.Array(Type.String())),
};

export const McpConnectionInputSchema = Type.Union([
  Type.Object(
    {
      ...McpConnectionInputFields,
      mode: Type.Literal('command'),
      command: McpConnectionCommandSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...McpConnectionInputFields,
      mode: Type.Literal('endpoint'),
      endpoint: McpConnectionEndpointSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...McpConnectionInputFields,
      mode: Type.Literal('docker'),
      docker: McpConnectionDockerSchema,
    },
    { additionalProperties: false },
  ),
]);
export type McpConnectionInput = Static<typeof McpConnectionInputSchema>;

export const McpConnectionPatchSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' })),
    scope: Type.Optional(McpConnectionScopeSchema),
    projectId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
    mode: Type.Optional(McpConnectionModeSchema),
    command: Type.Optional(McpConnectionCommandSchema),
    endpoint: Type.Optional(McpConnectionEndpointSchema),
    docker: Type.Optional(McpConnectionDockerSchema),
    allowServerInitiatedModelCalls: Type.Optional(Type.Boolean()),
    enabled: Type.Optional(Type.Boolean()),
    timeoutsMs: Type.Optional(Type.Partial(McpTimeoutsSchema, { additionalProperties: false })),
    tags: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);
export type McpConnectionPatch = Static<typeof McpConnectionPatchSchema>;

export const McpConnectionServerInfoSchema = Type.Object(
  { name: Type.String(), version: Type.String() },
  { additionalProperties: false },
);

export const McpConnectionStateSchema = Type.Object(
  {
    connectionId: Type.String({ format: 'uuid' }),
    status: Type.Union([
      Type.Literal('disconnected'),
      Type.Literal('connecting'),
      Type.Literal('connected'),
      Type.Literal('error'),
    ]),
    negotiatedRevision: Type.Union([McpRevisionSchema, Type.Null()]),
    transport: Type.Union([Type.String(), Type.Null()]),
    serverInfo: Type.Union([McpConnectionServerInfoSchema, Type.Null()]),
    capabilities: Type.Unknown(),
    toolCount: Type.Integer({ minimum: 0 }),
    lastError: Type.Union([Type.String(), Type.Null()]),
    lastConnectedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    containerId: Type.Union([Type.String(), Type.Null()]),
    legacy: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type McpConnectionState = Static<typeof McpConnectionStateSchema>;

export const McpConnectionListEntrySchema = Type.Object(
  { config: McpConnectionConfigSchema, state: McpConnectionStateSchema },
  { additionalProperties: false },
);
export type McpConnectionListEntry = Static<typeof McpConnectionListEntrySchema>;

export const McpToolsResultSchema = Type.Object(
  {
    tools: Type.Array(ToolDefinitionSchema),
    revision: McpRevisionSchema,
    cachedAt: Type.String({ format: 'date-time' }),
    ttlMs: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const McpConnectionLogEntrySchema = Type.Object(
  {
    at: Type.String({ format: 'date-time' }),
    level: Type.Union([
      Type.Literal('debug'),
      Type.Literal('info'),
      Type.Literal('warning'),
      Type.Literal('error'),
    ]),
    message: Type.String(),
  },
  { additionalProperties: false },
);
export type McpConnectionLogEntry = Static<typeof McpConnectionLogEntrySchema>;

export type McpToolsResult = Static<typeof McpToolsResultSchema>;

export const McpConnectionStateChangedSchema = Type.Object(
  { state: McpConnectionStateSchema },
  { additionalProperties: false },
);

export const McpInputRequiredSchema = Type.Object(
  {
    connectionId: Type.String({ format: 'uuid' }),
    requestId: Type.String(),
    requests: Type.Unknown(),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const McpToolClassifySchema = Type.Object(
  {
    connectionId: Type.String({ format: 'uuid' }),
    toolName: Type.String(),
    sideEffects: Type.Optional(
      Type.Union([
        Type.Literal('none'),
        Type.Literal('workspace-write'),
        Type.Literal('external-write'),
        Type.Literal('paid'),
        Type.Literal('destructive'),
      ]),
    ),
    executionMode: Type.Optional(
      Type.Union([
        Type.Literal('project-file'),
        Type.Literal('headless-process'),
        Type.Literal('live-editor'),
      ]),
    ),
  },
  { additionalProperties: false },
);

export const McpAccessModeSchema = AccessModeSchema;
