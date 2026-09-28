import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext, type ToolHandler } from './tool-registry';

const definition: ToolDefinition = {
  toolId: 'test/echo',
  title: 'Test echo',
  description: 'Echo test input.',
  inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
  outputSchema: { type: 'string' },
  executionMode: 'project-file',
  sideEffects: 'none',
  evidence: 'Echoed value.',
  capabilities: ['test.echo'],
  source: 'test',
};

describe('ToolRegistry', () => {
  it('rejects duplicate tool IDs', () => {
    const registry = new ToolRegistry();
    const handler: ToolHandler = async (_context: ToolContext, input: unknown) => ({
      output: input,
    });
    registry.register(definition, handler);
    expect(() => registry.register(definition, handler)).toThrow(
      'Tool already registered: test/echo',
    );
  });
});
