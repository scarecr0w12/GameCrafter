import { describe, expect, it } from 'vitest';
import type { SettingDefinition, SettingGroup } from '@gamecrafter/contracts';
import { controlKindFor, filterDefinitions, groupDefinitions } from './settings-view-model';

const definitions: SettingDefinition[] = [
  {
    key: 'models.routing.quality',
    title: 'Routing quality',
    description: 'Choose a model quality preference.',
    group: 'models',
    schema: { type: 'string', enum: ['quality-first', 'balanced'] },
    default: 'quality-first',
    scopes: ['platform', 'project'],
    source: 'builtin',
  },
  {
    key: 'agents.maxDepth',
    title: 'Maximum depth',
    description: 'Limit recursive delegation.',
    group: 'agents',
    schema: { type: 'integer', minimum: 1 },
    default: 4,
    scopes: ['platform'],
    source: 'builtin',
  },
];

const groups: SettingGroup[] = [
  { id: 'agents', title: 'Agents', description: 'Agent settings', order: 1 },
  { id: 'models', title: 'Models', description: 'Model settings', order: 0 },
];

describe('settings view model helpers', () => {
  it('chooses controls for supported and unsupported schemas', () => {
    expect(controlKindFor({ type: 'boolean' })).toBe('boolean');
    expect(controlKindFor({ type: 'string', enum: ['a', 'b'] })).toBe('enum');
    expect(controlKindFor({ type: 'number' })).toBe('number');
    expect(controlKindFor({ type: 'string' })).toBe('string');
    expect(controlKindFor({ type: 'array' })).toBe('unsupported');
  });

  it('filters by setting key, title, or description without case sensitivity', () => {
    expect(filterDefinitions(definitions, 'QUALITY')).toEqual([definitions[0]]);
    expect(filterDefinitions(definitions, 'recursive')).toEqual([definitions[1]]);
    expect(filterDefinitions(definitions, '')).toEqual(definitions);
  });

  it('groups definitions in the configured page order', () => {
    expect(
      groupDefinitions(definitions, groups).map(({ group, definitions: entries }) => [
        group.id,
        entries.map((entry) => entry.key),
      ]),
    ).toEqual([
      ['models', ['models.routing.quality']],
      ['agents', ['agents.maxDepth']],
    ]);
  });
});
