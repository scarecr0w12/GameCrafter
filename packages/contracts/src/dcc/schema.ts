import { Static, Type } from '@sinclair/typebox';
import {
  EngineOperationEvidenceSchema,
  EngineRunArtifactSchema,
  EngineRunStatusSchema,
} from '../engines';
import { SideEffectSchema } from '../tools';

export const DccToolSchema = Type.Union([
  Type.Literal('blender'),
  Type.Literal('maya'),
  Type.Literal('3dsmax'),
  Type.Literal('cinema4d'),
  Type.Literal('zbrush'),
]);
export type DccTool = Static<typeof DccToolSchema>;

export const DccLayerSchema = Type.Union([Type.Literal('headless'), Type.Literal('live-bridge')]);
export type DccLayer = Static<typeof DccLayerSchema>;

export const DccLayerStatusSchema = Type.Union([
  Type.Literal('ready'),
  Type.Literal('unavailable'),
  Type.Literal('unverified'),
  Type.Literal('unsupported-os'),
]);
export type DccLayerStatus = Static<typeof DccLayerStatusSchema>;

export const DccInstallationKindSchema = Type.Union([
  Type.Literal('gui'),
  Type.Literal('python'),
  Type.Literal('batch'),
]);
export type DccInstallationKind = Static<typeof DccInstallationKindSchema>;

export const DccInstallationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    installationId: Type.String({ format: 'uuid' }),
    tool: DccToolSchema,
    executable: Type.String({ minLength: 1 }),
    kind: DccInstallationKindSchema,
    version: Type.Union([Type.String(), Type.Null()]),
    source: Type.Union([Type.Literal('detected'), Type.Literal('manual')]),
    hostOs: Type.Union([Type.Literal('linux'), Type.Literal('win32'), Type.Literal('darwin')]),
    viaWslInterop: Type.Boolean(),
    detectedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type DccInstallation = Static<typeof DccInstallationSchema>;

export const DccOperationSchema = Type.Union([
  Type.Literal('discover'),
  Type.Literal('inspect'),
  Type.Literal('import'),
  Type.Literal('export'),
  Type.Literal('convert'),
  Type.Literal('render-preview'),
  Type.Literal('run-script'),
  Type.Literal('validate'),
]);
export type DccOperation = Static<typeof DccOperationSchema>;

export const DccOperationCapabilitySchema = Type.Object(
  {
    operation: DccOperationSchema,
    layer: DccLayerSchema,
    available: Type.Boolean(),
    reason: Type.Union([Type.String(), Type.Null()]),
    sideEffects: SideEffectSchema,
    requiresLiveBridge: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type DccOperationCapability = Static<typeof DccOperationCapabilitySchema>;

export const DccOsSupportSchema = Type.Object(
  {
    tool: DccToolSchema,
    os: Type.Union([Type.Literal('linux'), Type.Literal('win32'), Type.Literal('darwin')]),
    headless: Type.Union([
      Type.Literal('documented'),
      Type.Literal('unverified'),
      Type.Literal('unsupported'),
    ]),
    liveBridge: Type.Union([Type.Literal('community-plugin'), Type.Literal('none')]),
    sourceNote: Type.String(),
  },
  { additionalProperties: false },
);
export type DccOsSupport = Static<typeof DccOsSupportSchema>;

export const DccLayerReportSchema = Type.Object(
  {
    status: DccLayerStatusSchema,
    detail: Type.String(),
    checkedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type DccLayerReport = Static<typeof DccLayerReportSchema>;

export const DccLiveBridgeReportSchema = Type.Object(
  {
    status: DccLayerStatusSchema,
    detail: Type.String(),
    checkedAt: Type.String({ format: 'date-time' }),
    connectionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    mcpRevision: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type DccLiveBridgeReport = Static<typeof DccLiveBridgeReportSchema>;

export const DccCapabilityReportSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    tool: DccToolSchema,
    generatedAt: Type.String({ format: 'date-time' }),
    installation: Type.Union([DccInstallationSchema, Type.Null()]),
    layers: Type.Object(
      {
        headless: DccLayerReportSchema,
        'live-bridge': DccLiveBridgeReportSchema,
      },
      { additionalProperties: false },
    ),
    operations: Type.Array(DccOperationCapabilitySchema),
    osSupport: DccOsSupportSchema,
  },
  { additionalProperties: false },
);
export type DccCapabilityReport = Static<typeof DccCapabilityReportSchema>;

export const DccRunSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    runId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    tool: DccToolSchema,
    operation: DccOperationSchema,
    layer: DccLayerSchema,
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
export type DccRun = Static<typeof DccRunSchema>;
