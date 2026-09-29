import { Static, Type } from '@sinclair/typebox';

export const ASSET_PROVIDER_KINDS = ['meshy', 'tripo3d'] as const;

export const AssetProviderKindSchema = Type.Union([Type.Literal('meshy'), Type.Literal('tripo3d')]);
export type AssetProviderKind = Static<typeof AssetProviderKindSchema>;

export const AssetJobKindSchema = Type.Union([
  Type.Literal('text-to-3d'),
  Type.Literal('image-to-3d'),
  Type.Literal('refine'),
  Type.Literal('convert'),
]);
export type AssetJobKind = Static<typeof AssetJobKindSchema>;

export const AssetOutputFormatSchema = Type.Union([
  Type.Literal('glb'),
  Type.Literal('gltf'),
  Type.Literal('fbx'),
  Type.Literal('obj'),
  Type.Literal('usdz'),
  Type.Literal('stl'),
  Type.Literal('3mf'),
]);
export type AssetOutputFormat = Static<typeof AssetOutputFormatSchema>;

export const AssetProviderCapabilitiesSchema = Type.Object(
  {
    providerKind: AssetProviderKindSchema,
    jobKinds: Type.Array(AssetJobKindSchema),
    outputFormats: Type.Array(AssetOutputFormatSchema),
    supportsCancel: Type.Boolean(),
    supportsBalance: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type AssetProviderCapabilities = Static<typeof AssetProviderCapabilitiesSchema>;

export const AssetProviderAccountSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    accountId: Type.String({ format: 'uuid' }),
    providerKind: AssetProviderKindSchema,
    displayName: Type.String({ minLength: 1 }),
    baseUrl: Type.String({ format: 'uri' }),
    planTier: Type.Union([Type.String(), Type.Null()]),
    hasApiKey: Type.Boolean(),
    enabled: Type.Boolean(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type AssetProviderAccount = Static<typeof AssetProviderAccountSchema>;

export const AssetJobStatusSchema = Type.Union([
  Type.Literal('queued'),
  Type.Literal('submitted'),
  Type.Literal('running'),
  Type.Literal('downloading'),
  Type.Literal('review'),
  Type.Literal('approved'),
  Type.Literal('rejected'),
  Type.Literal('imported'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
  Type.Literal('expired'),
]);
export type AssetJobStatus = Static<typeof AssetJobStatusSchema>;

export const ASSET_JOB_TRANSITIONS: Record<AssetJobStatus, AssetJobStatus[]> = {
  queued: ['submitted', 'failed', 'cancelled'],
  submitted: ['running', 'downloading', 'failed', 'cancelled', 'expired'],
  running: ['downloading', 'failed', 'cancelled', 'expired'],
  downloading: ['review', 'failed'],
  review: ['approved', 'rejected'],
  approved: ['imported', 'rejected'],
  rejected: ['approved'],
  imported: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function isTerminalAssetJobStatus(status: AssetJobStatus): boolean {
  return ASSET_JOB_TRANSITIONS[status].length === 0;
}

export function isValidAssetJobTransition(from: AssetJobStatus, to: AssetJobStatus): boolean {
  return ASSET_JOB_TRANSITIONS[from].includes(to);
}

export const AssetJobRequestSchema = Type.Object(
  {
    kind: AssetJobKindSchema,
    prompt: Type.Optional(Type.String({ maxLength: 4000 })),
    negativePrompt: Type.Optional(Type.String({ maxLength: 4000 })),
    imagePath: Type.Optional(Type.String({ minLength: 1 })),
    sourceJobId: Type.Optional(Type.String({ format: 'uuid' })),
    outputFormat: AssetOutputFormatSchema,
    providerOptions: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);
export type AssetJobRequest = Static<typeof AssetJobRequestSchema>;

export const AssetArtifactSchema = Type.Object(
  {
    artifactId: Type.String({ format: 'uuid' }),
    jobId: Type.String({ format: 'uuid' }),
    kind: Type.Union([
      Type.Literal('model'),
      Type.Literal('thumbnail'),
      Type.Literal('texture'),
      Type.Literal('other'),
    ]),
    format: Type.String({ minLength: 1 }),
    path: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: '^[a-fA-F0-9]{64}$' }),
    bytes: Type.Integer({ minimum: 0 }),
    downloadedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type AssetArtifact = Static<typeof AssetArtifactSchema>;

export const AssetProvenanceSchema = Type.Object(
  {
    providerKind: AssetProviderKindSchema,
    accountId: Type.String({ format: 'uuid' }),
    providerTaskId: Type.Union([Type.String(), Type.Null()]),
    planTier: Type.Union([Type.String(), Type.Null()]),
    request: AssetJobRequestSchema,
    submittedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    completedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    creditsConsumed: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    termsSnapshot: Type.Object(
      {
        url: Type.String({ format: 'uri' }),
        capturedAt: Type.String({ format: 'date-time' }),
        note: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    requestedBy: Type.Object(
      {
        kind: Type.Union([Type.Literal('user'), Type.Literal('task')]),
        ref: Type.Union([Type.String(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type AssetProvenance = Static<typeof AssetProvenanceSchema>;

export const AssetJobSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    jobId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    providerKind: AssetProviderKindSchema,
    accountId: Type.String({ format: 'uuid' }),
    status: AssetJobStatusSchema,
    progress: Type.Integer({ minimum: 0, maximum: 100 }),
    providerTaskId: Type.Union([Type.String(), Type.Null()]),
    error: Type.Union([Type.String(), Type.Null()]),
    artifacts: Type.Array(AssetArtifactSchema),
    provenance: AssetProvenanceSchema,
    review: Type.Object(
      {
        decision: Type.Union([Type.Literal('approved'), Type.Literal('rejected'), Type.Null()]),
        note: Type.Union([Type.String(), Type.Null()]),
        decidedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    importedPath: Type.Union([Type.String(), Type.Null()]),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type AssetJob = Static<typeof AssetJobSchema>;

export const AssetPreviewKindSchema = Type.Union([
  Type.Literal('model-gltf'),
  Type.Literal('image'),
  Type.Literal('unavailable'),
]);
export type AssetPreviewKind = Static<typeof AssetPreviewKindSchema>;

export const AssetPreviewMetadataSchema = Type.Object(
  {
    gltfVersion: Type.Optional(Type.String()),
    generator: Type.Optional(Type.String()),
    nodes: Type.Optional(Type.Integer({ minimum: 0 })),
    meshes: Type.Optional(Type.Integer({ minimum: 0 })),
    materials: Type.Optional(Type.Integer({ minimum: 0 })),
    textures: Type.Optional(Type.Integer({ minimum: 0 })),
    animations: Type.Optional(Type.Array(Type.String())),
    extensionsUsed: Type.Optional(Type.Array(Type.String())),
    extensionsRequired: Type.Optional(Type.Array(Type.String())),
    lodLevels: Type.Optional(Type.Integer({ minimum: 0 })),
    width: Type.Optional(Type.Integer({ minimum: 0 })),
    height: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);
export type AssetPreviewMetadata = Static<typeof AssetPreviewMetadataSchema>;

export const AssetPreviewSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    previewId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    sourcePath: Type.String({ minLength: 1 }),
    sourceSha256: Type.String({ pattern: '^[a-fA-F0-9]{64}$' }),
    sourceBytes: Type.Integer({ minimum: 0 }),
    kind: AssetPreviewKindSchema,
    derivativePath: Type.Union([Type.String(), Type.Null()]),
    mimeType: Type.Union([Type.String(), Type.Null()]),
    warnings: Type.Array(Type.String()),
    metadata: AssetPreviewMetadataSchema,
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type AssetPreview = Static<typeof AssetPreviewSchema>;

export const AssetFileEntrySchema = Type.Object(
  {
    path: Type.String({ minLength: 1 }),
    bytes: Type.Integer({ minimum: 0 }),
    extension: Type.String(),
    modifiedAt: Type.String({ format: 'date-time' }),
    provenancePath: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type AssetFileEntry = Static<typeof AssetFileEntrySchema>;
