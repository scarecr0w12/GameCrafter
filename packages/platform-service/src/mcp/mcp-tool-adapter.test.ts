import { describe, expect, it, vi } from 'vitest';
import { uuidv7, type McpConnectionConfig } from '@gamecrafter/contracts';
import { ToolRegistry } from '../tools/tool-registry';
import { McpToolAdapter } from './mcp-tool-adapter';
import type { McpToolDescriptor } from './session';

const connection: McpConnectionConfig = {
  connectionId: uuidv7(),
  name: 'fixture-tools',
  scope: 'platform',
  projectId: null,
  mode: 'command',
  command: { command: 'fixture', args: [], env: {} },
  allowServerInitiatedModelCalls: false,
  enabled: true,
  timeoutsMs: { connect: 15_000, request: 60_000 },
  tags: [],
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
};

const objectSchema = {
  type: 'object',
  properties: { value: { type: 'string' } },
  additionalProperties: false,
};

const tools: McpToolDescriptor[] = [
  { name: 'echo', inputSchema: objectSchema, annotations: { readOnlyHint: true } },
  { name: 'write_file', inputSchema: objectSchema, annotations: { destructiveHint: true } },
  { name: 'unannotated', inputSchema: objectSchema },
  { name: 'execute_code', inputSchema: objectSchema, annotations: { readOnlyHint: true } },
];

describe('McpToolAdapter', () => {
  it('registers namespaced tools with safe default metadata and user overrides', async () => {
    const registry = new ToolRegistry();
    const adapter = new McpToolAdapter(registry);
    const invoke = vi.fn(async (...args: unknown[]) => ({ name: args[0] as string }));
    adapter.register(
      connection,
      tools,
      (name) =>
        name === 'unannotated'
          ? { sideEffects: 'paid', executionMode: 'project-file' }
          : { sideEffects: null, executionMode: null },
      (name, input, context) => invoke(name, input, context),
    );

    const definitions = adapter.list(connection.connectionId);
    expect(definitions.map((definition) => [definition.toolId, definition.sideEffects])).toEqual([
      ['fixture-tools/echo', 'none'],
      ['fixture-tools/execute_code', 'destructive'],
      ['fixture-tools/unannotated', 'paid'],
      ['fixture-tools/write_file', 'destructive'],
    ]);
    expect(
      definitions.find((definition) => definition.toolId.endsWith('/unannotated'))?.executionMode,
    ).toBe('project-file');
    expect(
      definitions.every((definition) => definition.source === `mcp:${connection.connectionId}`),
    ).toBe(true);

    const registered = registry.get('fixture-tools/echo');
    expect(registered).toBeDefined();
    expect(registry.validateInput(registered!, { value: 42 })).not.toEqual([]);
    const result = await registered!.handler(
      {
        projectId: uuidv7(),
        projectPath: '/tmp/project',
        taskId: null,
        agentId: null,
        accessMode: 'restricted',
        callId: uuidv7(),
        signal: new AbortController().signal,
      },
      { value: 'hello' },
    );
    expect(result.output).toEqual({ name: 'echo' });
    expect(result.evidence).toEqual([{ kind: 'mcp-tool', ref: 'fixture-tools/echo' }]);
    expect(invoke).toHaveBeenCalledWith('echo', { value: 'hello' }, expect.anything());
  });
});
