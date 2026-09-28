import { Static, Type, type TSchema } from '@sinclair/typebox';

export const SettingsScope = Type.Union([
  Type.Literal('platform'),
  Type.Literal('project'),
  Type.Literal('session'),
]);
export type SettingsScope = Static<typeof SettingsScope>;

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
