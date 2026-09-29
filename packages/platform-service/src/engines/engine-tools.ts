import {
  EngineOperationRunSchema,
  type EngineOperation,
  type SideEffect,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';

const operations: EngineOperation[] = [
  'discover',
  'inspect',
  'import',
  'check',
  'build',
  'test',
  'run',
  'export',
  'validate',
  'edit-scene',
  'screenshot',
  'console',
];

export type EngineToolHandler = (
  operation: EngineOperation,
  context: ToolContext,
  params: Record<string, unknown>,
  runId?: string,
) => Promise<unknown>;

export function registerEngineTools(registry: ToolRegistry, handler: EngineToolHandler): void {
  for (const operation of operations) {
    const definition = toolDefinition(operation);
    registry.register(definition, async (context, input) => {
      const params = isRecord(input) && isRecord(input.params) ? input.params : {};
      const runId = isRecord(input) && typeof input.runId === 'string' ? input.runId : undefined;
      const run = await handler(operation, context, params, runId);
      return {
        output: run,
        evidence: [
          {
            kind: 'engine-run',
            ref: isRecord(run) && typeof run.runId === 'string' ? run.runId : operation,
          },
        ],
      };
    });
  }
}

function toolDefinition(operation: EngineOperation): ToolDefinition {
  const mode = executionMode(operation);
  const sideEffects = sideEffect(operation);
  return {
    toolId: `engine/${operation}`,
    title: `Engine ${operation}`,
    description: `Run the ${operation} operation using the configured Project engine connector.`,
    inputSchema: {
      type: 'object',
      properties: {
        params: { type: 'object', additionalProperties: true },
        runId: { type: 'string', format: 'uuid' },
      },
      additionalProperties: false,
    },
    outputSchema: EngineOperationRunSchema,
    executionMode: mode,
    sideEffects,
    evidence: 'Engine process exit status, logs, reports, and artifacts.',
    capabilities: [`engine:${operation}`],
    source: 'builtin',
  };
}

function executionMode(operation: EngineOperation): ToolDefinition['executionMode'] {
  if (operation === 'discover' || operation === 'inspect') return 'project-file';
  if (operation === 'edit-scene' || operation === 'screenshot' || operation === 'console')
    return 'live-editor';
  return 'headless-process';
}

function sideEffect(operation: EngineOperation): SideEffect {
  switch (operation) {
    case 'discover':
    case 'inspect':
    case 'check':
    case 'screenshot':
      return 'none';
    case 'console':
      return 'destructive';
    case 'import':
    case 'validate':
    case 'build':
    case 'test':
    case 'run':
    case 'export':
    case 'edit-scene':
      return 'workspace-write';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
