import { Static, Type } from '@sinclair/typebox';
import { AccessModeSchema } from '../tools';

export const SkillFrontmatterSchema = Type.Object(
  {
    name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
    description: Type.String({ minLength: 1, maxLength: 1024 }),
    license: Type.Optional(Type.String()),
    compatibility: Type.Optional(Type.String()),
    'allowed-tools': Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: true },
);
export type SkillFrontmatter = Static<typeof SkillFrontmatterSchema>;

export const SkillPlatformMetadataSchema = Type.Object(
  {
    version: Type.Optional(Type.String()),
    engines: Type.Optional(Type.Array(Type.String())),
    genres: Type.Optional(Type.Array(Type.String())),
    workTypes: Type.Optional(Type.Array(Type.String())),
    roles: Type.Optional(Type.Array(Type.String())),
    capabilities: Type.Optional(Type.Array(Type.String())),
    minPlatform: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type SkillPlatformMetadata = Static<typeof SkillPlatformMetadataSchema>;

export const SkillRecordSchema = Type.Object(
  {
    name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
    description: Type.String({ minLength: 1, maxLength: 1024 }),
    location: Type.String({ minLength: 1 }),
    scope: Type.Union([Type.Literal('platform'), Type.Literal('project'), Type.Literal('compat')]),
    source: Type.String(),
    resolvedRef: Type.Union([Type.String(), Type.Null()]),
    version: Type.Union([Type.String(), Type.Null()]),
    hash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    license: Type.Union([Type.String(), Type.Null()]),
    compatibility: Type.Union([Type.String(), Type.Null()]),
    allowedTools: Type.Union([Type.String(), Type.Null()]),
    platform: SkillPlatformMetadataSchema,
    resources: Type.Array(Type.String()),
    installedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type SkillRecord = Static<typeof SkillRecordSchema>;

export const SkillEnablementSchema = Type.Object(
  {
    name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
    enabled: Type.Boolean(),
    pinnedVersion: Type.Union([Type.String(), Type.Null()]),
    pinnedHash: Type.Union([Type.String(), Type.Null()]),
    roles: Type.Union([Type.Array(Type.String()), Type.Null()]),
    workTypes: Type.Union([Type.Array(Type.String()), Type.Null()]),
  },
  { additionalProperties: false },
);
export type SkillEnablement = Static<typeof SkillEnablementSchema>;

export const SkillCatalogEntrySchema = Type.Object(
  {
    name: Type.String(),
    description: Type.String(),
    location: Type.String(),
    scope: Type.Union([Type.Literal('platform'), Type.Literal('project'), Type.Literal('compat')]),
    version: Type.Union([Type.String(), Type.Null()]),
    score: Type.Number(),
  },
  { additionalProperties: false },
);
export type SkillCatalogEntry = Static<typeof SkillCatalogEntrySchema>;

export const ProjectSkillEntrySchema = Type.Object(
  {
    ...SkillRecordSchema.properties,
    enablement: Type.Union([SkillEnablementSchema, Type.Null()]),
    shadowedBy: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ProjectSkillEntry = Static<typeof ProjectSkillEntrySchema>;

export const SkillActivationSchema = Type.Object(
  {
    activationId: Type.String({ format: 'uuid' }),
    name: Type.String(),
    version: Type.Union([Type.String(), Type.Null()]),
    hash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    agentId: Type.Union([Type.String(), Type.Null()]),
    activatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type SkillActivation = Static<typeof SkillActivationSchema>;

export const SkillActivationResultSchema = Type.Object(
  {
    content: Type.String(),
    version: Type.Union([Type.String(), Type.Null()]),
    dir: Type.String(),
    resources: Type.Array(Type.String()),
    alreadyActive: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type SkillActivationResult = Static<typeof SkillActivationResultSchema>;

export const SkillValidationResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    errors: Type.Array(Type.String()),
    warnings: Type.Array(Type.String()),
    record: Type.Union([SkillRecordSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const RoleFrontmatterSchema = Type.Object(
  {
    name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
    description: Type.String(),
    'work-types': Type.String(),
    'requires-modules': Type.Optional(Type.String()),
    'model-pool': Type.Optional(Type.String()),
    'max-access': AccessModeSchema,
    tools: Type.Optional(Type.String()),
    'disallowed-tools': Type.Optional(Type.String()),
    skills: Type.Optional(Type.String()),
    'mcp-servers': Type.Optional(Type.Array(Type.String())),
    'max-turns': Type.Optional(Type.Integer()),
    memory: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('project')])),
    'board-subscriptions': Type.Optional(Type.String()),
    isolation: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('worktree')])),
    locks: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type RoleFrontmatter = Static<typeof RoleFrontmatterSchema>;

export const RoleRecordSchema = Type.Object(
  {
    name: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' }),
    description: Type.String(),
    workTypes: Type.Array(Type.String()),
    requiresModules: Type.Array(Type.String()),
    modelPool: Type.Union([Type.String(), Type.Null()]),
    maxAccess: AccessModeSchema,
    tools: Type.Array(Type.String()),
    disallowedTools: Type.Array(Type.String()),
    skills: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    maxTurns: Type.Union([Type.Integer(), Type.Null()]),
    memory: Type.Union([Type.Literal('none'), Type.Literal('project')]),
    boardSubscriptions: Type.Array(Type.String()),
    isolation: Type.Union([Type.Literal('none'), Type.Literal('worktree')]),
    locks: Type.Array(Type.String()),
    location: Type.String({ minLength: 1 }),
    scope: Type.Union([Type.Literal('builtin'), Type.Literal('platform'), Type.Literal('project')]),
    systemPrompt: Type.String(),
    hash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  },
  { additionalProperties: false },
);
export type RoleRecord = Static<typeof RoleRecordSchema>;
