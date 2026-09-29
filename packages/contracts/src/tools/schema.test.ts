import { describe, expect, it } from 'vitest';
import { compile } from '../validation';
import {
  ACCESS_MODE_RANK,
  AccessModeSchema,
  ApprovalRequestSchema,
  minAccessMode,
  SIDE_EFFECT_RANK,
  ToolCallRecordSchema,
  ToolDefinitionSchema,
  type ToolCallRecord,
  type ToolDefinition,
} from './schema';

const definition: ToolDefinition = {
  toolId: 'fs/read-file',
  title: 'Read file',
  description: 'Read a Project file.',
  inputSchema: { type: 'object' },
  executionMode: 'project-file',
  sideEffects: 'none',
  evidence: 'File content and byte count.',
  capabilities: ['fs.read:project'],
  source: 'builtin',
};

const call: ToolCallRecord = {
  callId: '019535d4-2c00-7000-8000-000000000201',
  projectId: '019535d4-2c00-7000-8000-000000000202',
  taskId: null,
  agentId: null,
  toolId: definition.toolId,
  input: { path: 'docs/README.md' },
  accessMode: 'restricted',
  decision: 'allowed',
  decisionReason: 'side effect allowed',
  status: 'completed',
  output: { content: 'Design notes', encoding: 'utf8', bytes: 12 },
  error: null,
  evidence: [{ kind: 'file', ref: 'docs/README.md' }],
  costUsd: 0,
  startedAt: '2026-09-28T00:00:00.000Z',
  finishedAt: '2026-09-28T00:00:01.000Z',
};

describe('tool contracts', () => {
  it('assigns stable side-effect and access-mode ranks', () => {
    expect(SIDE_EFFECT_RANK).toEqual({
      none: 0,
      'workspace-write': 1,
      'external-write': 2,
      paid: 3,
      destructive: 4,
    });
    expect(ACCESS_MODE_RANK).toEqual({ 'ask-always': 0, restricted: 1, full: 2 });
    expect(minAccessMode('full', 'restricted')).toBe('restricted');
    expect(minAccessMode('ask-always', 'full')).toBe('ask-always');
  });

  it('allows MCP tool namespaced IDs that preserve server tool names', () => {
    const mcpDefinition = {
      ...definition,
      toolId: 'dungeon-tools/write_file',
      source: 'mcp:019535d4-2c00-7000-8000-000000000204',
    };
    expect(compile(ToolDefinitionSchema).check(mcpDefinition)).toBe(true);
    expect(
      compile(ToolCallRecordSchema).check({
        ...call,
        toolId: mcpDefinition.toolId,
      }),
    ).toBe(true);
  });

  it('validates tool definitions, call records, and approvals', () => {
    expect(compile<ToolDefinition>(ToolDefinitionSchema).check(definition)).toBe(true);
    expect(compile<ToolCallRecord>(ToolCallRecordSchema).check(call)).toBe(true);
    expect(
      compile(ApprovalRequestSchema).check({
        approvalId: '019535d4-2c00-7000-8000-000000000203',
        projectId: call.projectId,
        callId: call.callId,
        toolId: call.toolId,
        sideEffects: 'workspace-write',
        summary: 'Write project file',
        input: { path: 'docs/README.md', content: '[REDACTED]' },
        requestedAt: call.startedAt,
        resolvedAt: null,
        approved: null,
        reason: null,
      }),
    ).toBe(true);
    expect(compile(AccessModeSchema).check('full')).toBe(true);
    expect(compile(AccessModeSchema).check('invalid')).toBe(false);
  });
});
