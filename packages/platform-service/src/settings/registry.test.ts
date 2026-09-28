import { describe, expect, it } from 'vitest';
import { createBuiltinSettings } from './definitions';
import { SettingsRegistry } from './registry';

describe('SettingsRegistry', () => {
  it('describes the stable builtin groups and settings', () => {
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);

    const description = registry.describe();
    expect(description.groups).toHaveLength(10);
    expect(description.definitions).toHaveLength(15);
    expect(description.groups[0]?.id).toBe('general');
    expect(description.groups[9]?.id).toBe('logs');
  });

  it('rejects duplicate keys', () => {
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);

    expect(() => registry.register('plugin.example', [], [builtins.definitions[0]!])).toThrow(
      'Duplicate setting key: window.closeBehavior',
    );
  });

  it('validates defaults while registering definitions', () => {
    const registry = new SettingsRegistry();
    const groups = [{ id: 'test', title: 'Test', description: 'Test settings', order: 0 }];

    expect(() =>
      registry.register('plugin.example', groups, [
        {
          key: 'test.invalidDefault',
          title: 'Invalid default',
          description: 'The default does not match its schema.',
          group: 'test',
          schema: { type: 'integer', minimum: 0 },
          default: 'invalid',
          scopes: ['platform'],
          source: 'plugin.example',
        },
      ]),
    ).toThrow(/Invalid default for setting test.invalidDefault/);
  });
});
