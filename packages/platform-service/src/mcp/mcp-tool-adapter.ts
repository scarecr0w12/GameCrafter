import {
  RpcError,
  RpcErrorCode,
  type ExecutionMode,
  type McpConnectionConfig,
  type SideEffect,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';
import { requiresDestructiveSideEffects } from '../tools/tool-security';
import type { McpToolDescriptor } from './session';

export interface McpToolClassification {
  sideEffects: SideEffect | null;
  executionMode: ExecutionMode | null;
}

export type McpToolInvoker = (
  toolName: string,
  input: unknown,
  context: ToolContext,
) => Promise<unknown>;

export class McpToolAdapter {
  constructor(private readonly registry: ToolRegistry) {}

  register(
    config: McpConnectionConfig,
    tools: McpToolDescriptor[],
    getClassification: (toolName: string) => McpToolClassification,
    invoke: McpToolInvoker,
  ): void {
    this.unregister(config.connectionId);
    for (const tool of tools) {
      const definition = toToolDefinition(config, tool, getClassification(tool.name));
      this.registry.register(definition, async (context, input) => {
        const output = await invoke(tool.name, input, context);
        if (isRecord(output) && output.isError === true) {
          throw new RpcError(
            `MCP tool ${config.name}/${tool.name} returned an error`,
            RpcErrorCode.McpRequestFailed,
            output,
          );
        }
        return {
          output,
          evidence: [{ kind: 'mcp-tool', ref: `${config.name}/${tool.name}` }],
        };
      });
    }
  }

  unregister(connectionId: string): string[] {
    return this.registry.unregisterSource(mcpToolSource(connectionId));
  }

  list(connectionId: string): ToolDefinition[] {
    const source = mcpToolSource(connectionId);
    return this.registry.list().filter((tool) => tool.source === source);
  }
}

function toToolDefinition(
  config: McpConnectionConfig,
  tool: McpToolDescriptor,
  classification: McpToolClassification,
): ToolDefinition {
  const annotations = tool.annotations ?? {};
  const dangerousName = requiresDestructiveSideEffects(tool.name);
  const sideEffects: SideEffect = dangerousName
    ? 'destructive'
    : (classification.sideEffects ??
      (annotations.readOnlyHint === true
        ? 'none'
        : annotations.destructiveHint === true
          ? 'destructive'
          : 'external-write'));
  const executionMode: ExecutionMode =
    classification.executionMode ??
    ((config.tags ?? []).includes('live-editor') ? 'live-editor' : 'headless-process');
  return {
    toolId: `${config.name}/${tool.name}`,
    title: tool.title ?? tool.name,
    description: tool.description ?? `MCP tool ${tool.name} from ${config.name}`,
    inputSchema: tool.inputSchema,
    ...(tool.outputSchema === undefined ? {} : { outputSchema: tool.outputSchema }),
    executionMode,
    sideEffects,
    evidence: `MCP tool ${config.name}/${tool.name} result`,
    capabilities: [`mcp:${config.connectionId}`],
    source: mcpToolSource(config.connectionId),
  };
}

function mcpToolSource(connectionId: string): string {
  return `mcp:${connectionId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
