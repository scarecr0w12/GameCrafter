import {
  compile,
  compileJsonSchema2020,
  ToolDefinitionSchema,
  ValidationError,
  type AccessMode,
  type ToolDefinition,
  type ToolEvidence,
} from '@gamecrafter/contracts';

export interface ToolContext {
  projectId: string;
  projectPath: string;
  taskId: string | null;
  agentId: string | null;
  accessMode: AccessMode;
  callId: string;
  signal: AbortSignal;
}

export interface ToolExecutionResult {
  output: unknown;
  evidence?: ToolEvidence[];
  costUsd?: number;
}

export type ToolHandler = (
  context: ToolContext,
  input: unknown,
) => Promise<ToolExecutionResult> | ToolExecutionResult;

export interface RegisteredTool {
  definition: ToolDefinition;
  inputValidator: ReturnType<typeof compile<unknown>>;
  outputValidator?: ReturnType<typeof compile<unknown>>;
  handler: ToolHandler;
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(definition.toolId)) {
      throw new Error(`Tool already registered: ${definition.toolId}`);
    }
    compile<ToolDefinition>(ToolDefinitionSchema).assert(definition);
    const inputValidator = definition.source.startsWith('mcp:')
      ? compileJsonSchema2020<unknown>(
          definition.inputSchema as Parameters<typeof compileJsonSchema2020>[0],
        )
      : compile<unknown>(definition.inputSchema as Parameters<typeof compile>[0]);
    const outputValidator = definition.outputSchema
      ? definition.source.startsWith('mcp:')
        ? compileJsonSchema2020<unknown>(
            definition.outputSchema as Parameters<typeof compileJsonSchema2020>[0],
          )
        : compile<unknown>(definition.outputSchema as Parameters<typeof compile>[0])
      : undefined;
    this.tools.set(definition.toolId, {
      definition: { ...definition, capabilities: [...definition.capabilities] },
      inputValidator,
      outputValidator,
      handler,
    });
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  unregisterSource(source: string): string[] {
    const removed: string[] = [];
    for (const [toolId, tool] of this.tools) {
      if (tool.definition.source !== source) continue;
      this.tools.delete(toolId);
      removed.push(toolId);
    }
    return removed.sort((left, right) => left.localeCompare(right));
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()]
      .map(({ definition }) => ({ ...definition, capabilities: [...definition.capabilities] }))
      .sort((left, right) => left.toolId.localeCompare(right.toolId));
  }

  get(toolId: string): RegisteredTool | undefined {
    return this.tools.get(toolId);
  }

  validateInput(tool: RegisteredTool, input: unknown): string[] {
    if (tool.inputValidator.check(input)) return [];
    try {
      tool.inputValidator.assert(input);
    } catch (error) {
      if (error instanceof ValidationError) return error.errors;
      throw error;
    }
    return [];
  }

  validateOutput(tool: RegisteredTool, output: unknown): string[] {
    if (!tool.outputValidator || tool.outputValidator.check(output)) return [];
    try {
      tool.outputValidator.assert(output);
    } catch (error) {
      if (error instanceof ValidationError) return error.errors;
      throw error;
    }
    return [];
  }
}
