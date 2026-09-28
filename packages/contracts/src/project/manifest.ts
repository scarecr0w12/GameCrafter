import { Static, Type } from '@sinclair/typebox';
import { compile } from '../validation';

export const PROJECT_MANIFEST_FILENAME = 'gamecrafter.project.json';
export const PROJECT_MANIFEST_SCHEMA_VERSION = 1;

export const EngineFamily = Type.Union([
  Type.Literal('unity'),
  Type.Literal('unreal'),
  Type.Literal('godot'),
]);
export type EngineFamily = Static<typeof EngineFamily>;

const EngineSchema = Type.Object(
  {
    family: EngineFamily,
    preferredVersion: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const ProjectManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ default: '' }),
    engine: EngineSchema,
    genres: Type.Array(Type.String()),
    modules: Type.Array(Type.String()),
    createdAt: Type.String({ format: 'date-time' }),
    createdByPlatformVersion: Type.String(),
  },
  {
    $id: 'https://gamecrafter.dev/schemas/project-manifest/v1',
    additionalProperties: false,
  },
);

export type ProjectManifest = Static<typeof ProjectManifestSchema>;
export const projectManifest = compile<ProjectManifest>(ProjectManifestSchema);

export const ProjectCreateInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.Optional(Type.String()),
    engine: EngineSchema,
    genres: Type.Optional(Type.Array(Type.String())),
    modules: Type.Optional(Type.Array(Type.String())),
    parentDirectory: Type.String(),
    folderName: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type ProjectCreateInput = Static<typeof ProjectCreateInputSchema>;

export const ProjectSummarySchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    name: Type.String(),
    description: Type.String(),
    engine: EngineSchema,
    genres: Type.Array(Type.String()),
    modules: Type.Array(Type.String()),
    path: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    lastOpenedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ProjectSummary = Static<typeof ProjectSummarySchema>;
