import { Static, Type, type TSchema } from '@sinclair/typebox';

export const SettingsScope = Type.Union([
  Type.Literal('platform'),
  Type.Literal('project'),
  Type.Literal('session'),
]);
export type SettingsScope = Static<typeof SettingsScope>;

export const SettingDefinitionSchema = Type.Object(
  {
    key: Type.String({ pattern: '^[a-z][a-zA-Z0-9-]*(\\.[a-z][a-zA-Z0-9-]*)+$' }),
    title: Type.String(),
    description: Type.String(),
    group: Type.String(),
    schema: Type.Record(Type.String(), Type.Unknown()),
    default: Type.Unknown(),
    scopes: Type.Array(SettingsScope),
    requiresRestart: Type.Optional(Type.Boolean()),
    source: Type.String(),
  },
  { additionalProperties: false },
);
export type SettingDefinition = Static<typeof SettingDefinitionSchema>;

export const SettingGroupSchema = Type.Object(
  {
    id: Type.String(),
    title: Type.String(),
    description: Type.String(),
    order: Type.Integer(),
  },
  { additionalProperties: false },
);
export type SettingGroup = Static<typeof SettingGroupSchema>;

export const EffectiveSettingSchema = Type.Object(
  {
    key: Type.String(),
    value: Type.Unknown(),
    source: Type.Union([SettingsScope, Type.Literal('default')]),
    layers: Type.Object(
      {
        default: Type.Unknown(),
        platform: Type.Optional(Type.Unknown()),
        project: Type.Optional(Type.Unknown()),
        session: Type.Optional(Type.Unknown()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type EffectiveSetting = Static<typeof EffectiveSettingSchema>;

export type EffectiveValue<T> = {
  value: T;
  source: SettingsScope | 'default';
};

export function EffectiveValueSchema<T extends TSchema>(valueSchema: T) {
  return Type.Object(
    {
      value: valueSchema,
      source: Type.Union([SettingsScope, Type.Literal('default')]),
    },
    { additionalProperties: false },
  );
}

export const SettingsExportSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    exportedAt: Type.String({ format: 'date-time' }),
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    settings: Type.Array(EffectiveSettingSchema),
  },
  { additionalProperties: false },
);
export type SettingsExport = Static<typeof SettingsExportSchema>;

export const SettingsImportParamsSchema = Type.Object(
  {
    document: SettingsExportSchema,
    scope: Type.Union([Type.Literal('platform'), Type.Literal('project')]),
    projectId: Type.Optional(Type.String({ format: 'uuid' })),
    dryRun: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type SettingsImportParams = Static<typeof SettingsImportParamsSchema>;
export const SettingsImportResultSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    dryRun: Type.Boolean(),
    importedKeys: Type.Array(Type.String()),
    skipped: Type.Array(
      Type.Object(
        {
          key: Type.String(),
          reason: Type.Union([
            Type.Literal('unknown-setting'),
            Type.Literal('redacted-value'),
            Type.Literal('no-override'),
          ]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type SettingsImportResult = Static<typeof SettingsImportResultSchema>;
