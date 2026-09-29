import { Static, Type } from '@sinclair/typebox';

export const BackupScopeSchema = Type.Union([Type.Literal('project'), Type.Literal('profile')]);
export type BackupScope = Static<typeof BackupScopeSchema>;

export const BackupIdentitySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    identityId: Type.String({ format: 'uuid' }),
    label: Type.String({ minLength: 1, maxLength: 200 }),
    publicKey: Type.String({ pattern: '^[A-Za-z0-9+/]+={0,2}$' }),
    kdf: Type.Object(
      {
        name: Type.Literal('scrypt'),
        salt: Type.String({ pattern: '^[A-Za-z0-9+/]+={0,2}$' }),
        logN: Type.Integer({ minimum: 14, maximum: 20 }),
        r: Type.Integer({ minimum: 1 }),
        p: Type.Integer({ minimum: 1 }),
      },
      { additionalProperties: false },
    ),
    encryptedPrivateKey: Type.Object(
      {
        iv: Type.String({ pattern: '^[A-Za-z0-9+/]+={0,2}$' }),
        ciphertext: Type.String({ pattern: '^[A-Za-z0-9+/]+={0,2}$' }),
        tag: Type.String({ pattern: '^[A-Za-z0-9+/]+={0,2}$' }),
      },
      { additionalProperties: false },
    ),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type BackupIdentity = Static<typeof BackupIdentitySchema>;

export const BackupDestinationKindSchema = Type.Union([
  Type.Literal('local'),
  Type.Literal('s3'),
  Type.Literal('ftp'),
  Type.Literal('google-drive'),
]);
export type BackupDestinationKind = Static<typeof BackupDestinationKindSchema>;

export const BackupLocalDestinationConfigSchema = Type.Object(
  { directory: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
export const BackupS3DestinationConfigSchema = Type.Object(
  {
    endpoint: Type.Optional(Type.String({ format: 'uri' })),
    region: Type.String({ minLength: 1 }),
    bucket: Type.String({ minLength: 1 }),
    prefix: Type.Optional(Type.String()),
    forcePathStyle: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export const BackupFtpDestinationConfigSchema = Type.Object(
  {
    host: Type.String({ minLength: 1 }),
    port: Type.Integer({ minimum: 1, maximum: 65535 }),
    user: Type.String({ minLength: 1 }),
    directory: Type.String(),
    secure: Type.Boolean(),
  },
  { additionalProperties: false },
);
export const BackupGoogleDriveDestinationConfigSchema = Type.Object(
  {
    folderId: Type.String({ minLength: 1 }),
    clientId: Type.String({ minLength: 1 }),
    tokenEndpoint: Type.Optional(Type.String({ format: 'uri' })),
    apiEndpoint: Type.Optional(Type.String({ format: 'uri' })),
  },
  { additionalProperties: false },
);
export const BackupDestinationConfigSchema = Type.Union([
  BackupLocalDestinationConfigSchema,
  BackupS3DestinationConfigSchema,
  BackupFtpDestinationConfigSchema,
  BackupGoogleDriveDestinationConfigSchema,
]);
export type BackupDestinationConfig = Static<typeof BackupDestinationConfigSchema>;

export const BackupDestinationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    destinationId: Type.String({ format: 'uuid' }),
    kind: BackupDestinationKindSchema,
    displayName: Type.String({ minLength: 1, maxLength: 200 }),
    config: BackupDestinationConfigSchema,
    hasSecrets: Type.Boolean(),
    enabled: Type.Boolean(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type BackupDestination = Static<typeof BackupDestinationSchema>;

export const BackupScheduleSchema = Type.Union([
  Type.Object({ kind: Type.Literal('manual') }, { additionalProperties: false }),
  Type.Object(
    { kind: Type.Literal('interval'), everyMinutes: Type.Integer({ minimum: 15 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('daily'), at: Type.String({ pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' }) },
    { additionalProperties: false },
  ),
]);
export type BackupSchedule = Static<typeof BackupScheduleSchema>;

export const BackupRetentionSchema = Type.Object(
  {
    keepLast: Type.Integer({ minimum: 1 }),
    keepDays: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BackupRetention = Static<typeof BackupRetentionSchema>;

export const BackupPlanSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    planId: Type.String({ format: 'uuid' }),
    scope: BackupScopeSchema,
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    destinationId: Type.String({ format: 'uuid' }),
    identityId: Type.String({ format: 'uuid' }),
    schedule: BackupScheduleSchema,
    retention: BackupRetentionSchema,
    enabled: Type.Boolean(),
    lastRunAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    nextRunAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type BackupPlan = Static<typeof BackupPlanSchema>;

export const BackupRunStatusSchema = Type.Union([
  Type.Literal('running'),
  Type.Literal('uploading'),
  Type.Literal('verifying'),
  Type.Literal('verified'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
]);
export type BackupRunStatus = Static<typeof BackupRunStatusSchema>;

export const BackupRunSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    runId: Type.String({ format: 'uuid' }),
    planId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    scope: BackupScopeSchema,
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    destinationId: Type.String({ format: 'uuid' }),
    identityId: Type.String({ format: 'uuid' }),
    archiveId: Type.String({ format: 'uuid' }),
    archiveName: Type.String({ minLength: 1 }),
    status: BackupRunStatusSchema,
    bytes: Type.Integer({ minimum: 0 }),
    sha256: Type.Union([Type.String({ pattern: '^[a-fA-F0-9]{64}$' }), Type.Null()]),
    files: Type.Integer({ minimum: 0 }),
    startedAt: Type.String({ format: 'date-time' }),
    finishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    verifiedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    drilledAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    prunedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    error: Type.Union([Type.String(), Type.Null()]),
    trigger: Type.Union([Type.Literal('manual'), Type.Literal('schedule')]),
  },
  { additionalProperties: false },
);
export type BackupRun = Static<typeof BackupRunSchema>;

export const BackupArchiveEntrySchema = Type.Object(
  {
    archiveName: Type.String({ minLength: 1 }),
    bytes: Type.Integer({ minimum: 0 }),
    modifiedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BackupArchiveEntry = Static<typeof BackupArchiveEntrySchema>;

export const BackupManifestEntrySchema = Type.Object(
  {
    path: Type.String({ minLength: 1 }),
    kind: Type.Union([Type.Literal('file'), Type.Literal('dir'), Type.Literal('symlink')]),
    bytes: Type.Integer({ minimum: 0 }),
    mode: Type.Integer({ minimum: 0 }),
    mtime: Type.String({ format: 'date-time' }),
    sha256: Type.Union([Type.String({ pattern: '^[a-fA-F0-9]{64}$' }), Type.Null()]),
    linkTarget: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type BackupManifestEntry = Static<typeof BackupManifestEntrySchema>;

export const BackupManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    archiveId: Type.String({ format: 'uuid' }),
    scope: BackupScopeSchema,
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    platformVersion: Type.String(),
    schemaVersions: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
    pluginVersions: Type.Record(Type.String(), Type.String()),
    entries: Type.Array(BackupManifestEntrySchema),
    excluded: Type.Array(Type.String()),
    notes: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type BackupManifest = Static<typeof BackupManifestSchema>;

export const BackupRestoreResultSchema = Type.Object(
  {
    targetPath: Type.String({ minLength: 1 }),
    scope: BackupScopeSchema,
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    registeredProjectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    manifest: BackupManifestSchema,
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type BackupRestoreResult = Static<typeof BackupRestoreResultSchema>;

export const BackupVerifyResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    archiveName: Type.String(),
    bytes: Type.Integer({ minimum: 0 }),
    sha256: Type.String({ pattern: '^[a-fA-F0-9]{64}$' }),
    files: Type.Integer({ minimum: 0 }),
    warnings: Type.Array(Type.String()),
    error: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BackupVerifyResult = Static<typeof BackupVerifyResultSchema>;
