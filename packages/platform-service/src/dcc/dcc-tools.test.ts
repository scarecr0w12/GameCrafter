import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../tools/tool-registry';
import { registerDccTools } from './dcc-tools';

describe('DCC broker tools', () => {
  it('registers script execution as destructive while keeping inspection read-only', () => {
    const registry = new ToolRegistry();
    registerDccTools(registry, async () => ({}));
    expect(registry.list().find((tool) => tool.toolId === 'dcc/run-script')).toMatchObject({
      sideEffects: 'destructive',
      capabilities: ['dcc:run-script'],
    });
    expect(registry.list().find((tool) => tool.toolId === 'dcc/inspect')).toMatchObject({
      sideEffects: 'none',
    });
  });
});
