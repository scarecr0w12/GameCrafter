import { Static, Type } from '@sinclair/typebox';
import { EngineFamily } from '../project/manifest';
import { McpRevisionSchema } from '../mcp';
import { ExecutionModeSchema, SideEffectSchema } from '../tools';

export const EngineInstallationKindSchema = Type.Union([
  Type.Literal('editor'),
  Type.Literal('cli'),
  Type.Literal('uat'),
  Type.Literal('commandlet'),
]);

export const EngineInstallationSourceSchema = Type.Union([
  Type.Literal('detected'),
  Type.Literal('manual'),
]);

export const EngineInstallationSchema = Type.Object(
  {
    installationId: Type.String({ format: 'uuid' }),
    family: EngineFamily,
    version: Type.Union([Type.String(), Type.Null()]),
    executable: Type.String({ minLength: 1 }),
    kind: EngineInstallationKindSchema,
    source: EngineInstallationSourceSchema,
    detectedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type EngineInstallation = Static<typeof EngineInstallationSchema>;

export const EngineOperationSchema = Type.Union([
  Type.Literal('discover'),
  Type.Literal('inspect'),
  Type.Literal('import'),
  Type.Literal('check'),
  Type.Literal('build'),
  Type.Literal('test'),
  Type.Literal('run'),
  Type.Literal('export'),
  Type.Literal('validate'),
  Type.Literal('edit-scene'),
  Type.Literal('screenshot'),
  Type.Literal('console'),
]);
export type EngineOperation = Static<typeof EngineOperationSchema>;

export const EngineLayerNameSchema = Type.Union([
  Type.Literal('project-file'),
  Type.Literal('headless-process'),
  Type.Literal('live-editor'),
]);
export type EngineLayerName = Static<typeof EngineLayerNameSchema>;

export const EngineLayerStatusSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal('ready'),
      Type.Literal('unavailable'),
      Type.Literal('unverified'),
    ]),
    detail: Type.String(),
    checkedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type EngineLayerStatus = Static<typeof EngineLayerStatusSchema>;

export const EngineIdentityEvidenceSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal('file'), Type.Literal('cli'), Type.Literal('mcp')]),
    ref: Type.String(),
    detail: Type.String(),
  },
  { additionalProperties: false },
);
export type EngineIdentityEvidence = Static<typeof EngineIdentityEvidenceSchema>;

export const EngineOperationCapabilitySchema = Type.Object(
  {
    operation: EngineOperationSchema,
    executionMode: ExecutionModeSchema,
    available: Type.Boolean(),
    via: Type.Union([Type.Literal('cli'), Type.Literal('mcp'), Type.Literal('file'), Type.Null()]),
    command: Type.Union([Type.String(), Type.Null()]),
    sideEffects: SideEffectSchema,
    evidence: Type.String(),
    reason: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type EngineOperationCapability = Static<typeof EngineOperationCapabilitySchema>;

export const EngineLiveBridgeSchema = Type.Object(
  {
    connectionId: Type.String({ format: 'uuid' }),
    negotiatedRevision: McpRevisionSchema,
    serverInfo: Type.Object(
      { name: Type.String(), version: Type.String() },
      { additionalProperties: false },
    ),
    toolCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type EngineLiveBridge = Static<typeof EngineLiveBridgeSchema>;

export const EngineCapabilityReportSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    family: EngineFamily,
    generatedAt: Type.String({ format: 'date-time' }),
    projectIdentity: Type.Object(
      {
        proven: Type.Boolean(),
        evidence: Type.Array(EngineIdentityEvidenceSchema),
        projectVersion: Type.Union([Type.String(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    layers: Type.Object(
      {
        'project-file': EngineLayerStatusSchema,
        'headless-process': EngineLayerStatusSchema,
        'live-editor': EngineLayerStatusSchema,
      },
      { additionalProperties: false },
    ),
    engineVersion: Type.Object(
      {
        detected: Type.Union([Type.String(), Type.Null()]),
        preferred: Type.Union([Type.String(), Type.Null()]),
        matches: Type.Union([Type.Boolean(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    operations: Type.Array(EngineOperationCapabilitySchema),
    liveBridge: Type.Union([EngineLiveBridgeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type EngineCapabilityReport = Static<typeof EngineCapabilityReportSchema>;

export const EngineRunStatusSchema = Type.Union([
  Type.Literal('running'),
  Type.Literal('succeeded'),
  Type.Literal('failed'),
  Type.Literal('unavailable'),
]);

export const EngineRunArtifactSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal('log'),
      Type.Literal('report'),
      Type.Literal('build'),
      Type.Literal('export'),
      Type.Literal('screenshot'),
    ]),
    path: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
export type EngineRunArtifact = Static<typeof EngineRunArtifactSchema>;

export const EngineOperationEvidenceSchema = Type.Object(
  { kind: Type.String(), ref: Type.String(), detail: Type.String() },
  { additionalProperties: false },
);
export type EngineOperationEvidence = Static<typeof EngineOperationEvidenceSchema>;

export const EngineOperationRunSchema = Type.Object(
  {
    runId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    family: EngineFamily,
    operation: EngineOperationSchema,
    executionMode: ExecutionModeSchema,
    status: EngineRunStatusSchema,
    startedAt: Type.String({ format: 'date-time' }),
    finishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    exitCode: Type.Union([Type.Integer(), Type.Null()]),
    command: Type.Array(Type.String()),
    artifacts: Type.Array(EngineRunArtifactSchema),
    evidence: Type.Array(EngineOperationEvidenceSchema),
    summary: Type.String(),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type EngineOperationRun = Static<typeof EngineOperationRunSchema>;
