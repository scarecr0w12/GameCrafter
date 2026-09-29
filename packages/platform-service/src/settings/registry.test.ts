import { describe, expect, it } from 'vitest';
import { createBuiltinSettings } from './definitions';
import { SettingsRegistry } from './registry';

describe('SettingsRegistry', () => {
  it('describes the stable builtin groups and settings', () => {
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);

    const description = registry.describe();
    expect(description.groups).toHaveLength(11);
    expect(description.definitions).toHaveLength(36);
    expect(
      description.definitions.find((definition) => definition.key === 'mcp.autoConnect'),
    ).toMatchObject({
      group: 'connections',
      default: true,
      scopes: ['platform', 'project'],
    });
    expect(
      description.definitions.find(
        (definition) => definition.key === 'mcp.reconnectBackoffSeconds',
      ),
    ).toMatchObject({ group: 'connections', default: 10, scopes: ['platform'] });
    expect(
      description.definitions.find(
        (definition) => definition.key === 'plugins.allowUnisolatedInFullAccess',
      ),
    ).toMatchObject({ group: 'plugins', default: false, scopes: ['platform'] });
    expect(
      description.definitions.find((definition) => definition.key === 'plugins.autoStart'),
    ).toMatchObject({ group: 'plugins', default: true, scopes: ['platform', 'project'] });
    expect(description.groups[0]?.id).toBe('general');
    expect(description.groups[9]?.id).toBe('logs');
    expect(description.groups[10]?.id).toBe('engine');
  });

  it('rejects duplicate keys', () => {
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);

    expect(() => registry.register('plugin.example', [], [builtins.definitions[0]!])).toThrow(
      'Duplicate setting key: window.closeBehavior',
    );
  });

  it('unregisters definitions contributed by one plugin', () => {
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);
    registry.register(
      'plugin:sample-hello',
      [],
      [
        {
          key: 'plugin.sample-hello.greetingPrefix',
          title: 'Greeting prefix',
          description: 'Plugin setting.',
          group: 'plugins',
          schema: { type: 'string' },
          default: 'Hello',
          scopes: ['project'],
          source: 'untrusted-input',
        },
      ],
    );

    expect(registry.unregisterSource('plugin:sample-hello')).toEqual([
      'plugin.sample-hello.greetingPrefix',
    ]);
    expect(registry.get('plugin.sample-hello.greetingPrefix')).toBeUndefined();
    expect(registry.get('plugins.autoStart')).toBeDefined();
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
