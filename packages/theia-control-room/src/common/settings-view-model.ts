import type { SettingDefinition, SettingGroup } from '@gamecrafter/contracts';

export type SettingControlKind =
  'boolean' | 'enum' | 'enum-array' | 'number' | 'string' | 'string-array' | 'unsupported';

export interface GroupedSettings {
  group: SettingGroup;
  definitions: SettingDefinition[];
}

export function controlKindFor(schema: Record<string, unknown>): SettingControlKind {
  if (schema.type === 'array') {
    const items =
      typeof schema.items === 'object' && schema.items !== null && !Array.isArray(schema.items)
        ? (schema.items as Record<string, unknown>)
        : undefined;
    if (items && Array.isArray(items.enum)) return 'enum-array';
    if (items?.type === 'string') return 'string-array';
    return 'unsupported';
  }
  if (Array.isArray(schema.enum)) return 'enum';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'string') return 'string';
  return 'unsupported';
}

export function filterDefinitions(
  definitions: SettingDefinition[],
  query: string,
): SettingDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return definitions;
  return definitions.filter((definition) =>
    [definition.key, definition.title, definition.description].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
}

export function groupDefinitions(
  definitions: SettingDefinition[],
  groups: SettingGroup[],
): GroupedSettings[] {
  return [...groups]
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      group,
      definitions: definitions.filter((definition) => definition.group === group.id),
    }));
}
