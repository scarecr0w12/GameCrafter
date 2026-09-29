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
  it('validates MCP tool input schemas with bounded JSON Schema 2020-12 references', () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        ...definition,
        toolId: 'world-tools/echo',
        source: 'mcp:connection-1',
        inputSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $defs: { value: { type: 'string' } },
          type: 'object',
          properties: { value: { $ref: '#/$defs/value' } },
          required: ['value'],
          additionalProperties: false,
        },
      },
      async (_context, input) => ({ output: input }),
    );
    const tool = registry.get('world-tools/echo')!;
    expect(registry.validateInput(tool, { value: 'ok' })).toEqual([]);
    expect(registry.validateInput(tool, { value: 1 })).not.toEqual([]);
    expect(() =>
      registry.register(
        {
          ...definition,
          toolId: 'world-tools/external-ref',
          source: 'mcp:connection-1',
          inputSchema: { $ref: 'https://example.invalid/schema.json' },
        },
        async (_context, input) => ({ output: input }),
      ),
    ).toThrow();
  });

  it('validates plugin tool schemas with JSON Schema 2020-12 references', () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        ...definition,
        toolId: 'com.example.plugin/echo',
        source: 'plugin:com.example.plugin',
        inputSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $defs: { value: { type: 'string' } },
          type: 'object',
          properties: { value: { $ref: '#/$defs/value' } },
          required: ['value'],
          additionalProperties: false,
        },
      },
      async (_context, input) => ({ output: input }),
    );
    const tool = registry.get('com.example.plugin/echo')!;
    expect(registry.validateInput(tool, { value: 'ok' })).toEqual([]);
    expect(registry.validateInput(tool, { value: 1 })).not.toEqual([]);
  });

  it('unregisters all tools owned by a source', () => {
    const registry = new ToolRegistry();
    const handler: ToolHandler = async (_context: ToolContext, input: unknown) => ({
      output: input,
    });
    registry.register(definition, handler);
    registry.register(
      { ...definition, toolId: 'world-tools/echo', source: 'mcp:connection-1' },
      handler,
    );
    registry.register(
      { ...definition, toolId: 'world-tools/write', source: 'mcp:connection-1' },
      handler,
    );

    expect(registry.unregisterSource('mcp:connection-1')).toEqual([
      'world-tools/echo',
      'world-tools/write',
    ]);
    expect(registry.list().map((tool) => tool.toolId)).toEqual(['test/echo']);
  });

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
