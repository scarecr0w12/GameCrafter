import {
  DCC_TOOLS,
  DccRunSchema,
  RpcError,
  RpcErrorCode,
  type DccOperation,
  type DccTool,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';
import { dccSideEffect } from './adapters/common';

const operations: DccOperation[] = [
  'discover',
  'inspect',
  'import',
  'export',
  'convert',
  'render-preview',
  'run-script',
  'validate',
];

export type DccToolHandler = (
  tool: DccTool,
  operation: DccOperation,
  context: ToolContext,
  params: Record<string, unknown>,
  runId?: string,
) => Promise<unknown>;

export function registerDccTools(registry: ToolRegistry, handler: DccToolHandler): void {
  for (const operation of operations) {
    const definition = toolDefinition(operation);
    registry.register(definition, async (context, input) => {
      const tool =
        isRecord(input) && DCC_TOOLS.includes(input.tool as DccTool)
          ? (input.tool as DccTool)
          : undefined;
      if (!tool) throw new RpcError('DCC tool is required.', RpcErrorCode.InvalidParams);
      const params = isRecord(input) && isRecord(input.params) ? input.params : {};
      const runId = isRecord(input) && typeof input.runId === 'string' ? input.runId : undefined;
      const run = await handler(tool, operation, context, params, runId);
      return {
        output: run,
        evidence: [
          {
            kind: 'dcc-run',
            ref: isRecord(run) && typeof run.runId === 'string' ? run.runId : operation,
          },
        ],
      };
    });
  }
}

function toolDefinition(operation: DccOperation): ToolDefinition {
  const sideEffects = dccSideEffect(operation);
  return {
    toolId: `dcc/${operation}`,
    title: `DCC ${operation}`,
    description: `Run the ${operation} operation using the configured DCC connector.`,
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', enum: DCC_TOOLS },
        params: { type: 'object', additionalProperties: true },
        runId: { type: 'string', format: 'uuid' },
      },
      additionalProperties: false,
    },
    outputSchema: DccRunSchema,
    executionMode: 'headless-process',
    sideEffects,
    evidence: 'DCC process exit status, logs, reports, and artifacts.',
    capabilities: [`dcc:${operation}`],
    source: 'builtin',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
