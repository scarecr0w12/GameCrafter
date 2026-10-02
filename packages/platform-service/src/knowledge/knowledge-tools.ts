import {
  CanonRecordSchema,
  KnowledgeGraphSchema,
  KnowledgeRecordResultSchema,
  KnowledgeSearchResultSchema,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext, type ToolExecutionResult } from '../tools/tool-registry';

export interface KnowledgeToolHandlers {
  search(context: ToolContext, input: unknown): Promise<ToolExecutionResult>;
  read(context: ToolContext, input: unknown): Promise<ToolExecutionResult>;
  write(context: ToolContext, input: unknown): Promise<ToolExecutionResult>;
  proposeStatus(context: ToolContext, input: unknown): Promise<ToolExecutionResult>;
  graph(context: ToolContext, input: unknown): Promise<ToolExecutionResult>;
  executeIndex(context: ToolContext, input: unknown): Promise<ToolExecutionResult>;
}

export function registerKnowledgeTools(
  registry: ToolRegistry,
  handlers: KnowledgeToolHandlers,
): void {
  registry.register(
    definition(
      'knowledge/search',
      'Search Project knowledge',
      {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1 },
          sources: { type: 'array', items: { type: 'string' } },
          recordTypes: { type: 'array', items: { type: 'string' } },
          statuses: { type: 'array', items: { type: 'string' } },
          includeInactive: { type: 'boolean' },
          mode: { type: 'string', enum: ['hybrid', 'lexical', 'semantic'] },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          maxTokens: { type: 'integer', minimum: 0, maximum: 200000 },
        },
        required: ['query'],
        additionalProperties: false,
      },
      KnowledgeSearchResultSchema,
      'none',
    ),
    handlers.search,
  );

  registry.register(
    definition(
      'canon/read',
      'Read canon record',
      {
        type: 'object',
        properties: { recordId: { type: 'string', minLength: 3 } },
        required: ['recordId'],
        additionalProperties: false,
      },
      KnowledgeRecordResultSchema,
      'none',
    ),
    handlers.read,
  );

  registry.register(
    definition(
      'canon/write',
      'Write a canon proposal',
      {
        type: 'object',
        properties: {
          recordId: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: ['draft', 'proposed'] },
          module: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          references: { type: 'array', items: { type: 'object' } },
          body: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['type', 'title', 'body'],
        additionalProperties: false,
      },
      CanonRecordSchema,
      'workspace-write',
    ),
    handlers.write,
  );

  registry.register(
    definition(
      'canon/propose-status',
      'Propose a canon status change',
      {
        type: 'object',
        properties: {
          recordId: { type: 'string', minLength: 3 },
          status: { type: 'string', enum: ['accepted', 'deprecated', 'retconned'] },
          rationale: { type: 'string', minLength: 1 },
        },
        required: ['recordId', 'status', 'rationale'],
        additionalProperties: false,
      },
      undefined,
      'internal-write',
    ),
    handlers.proposeStatus,
  );

  registry.register(
    definition(
      'canon/graph',
      'Read canon references',
      {
        type: 'object',
        properties: {
          recordId: { type: 'string' },
          depth: { type: 'integer', minimum: 1, maximum: 5 },
        },
        additionalProperties: false,
      },
      KnowledgeGraphSchema,
      'none',
    ),
    handlers.graph,
  );

  registry.register(
    definition(
      'knowledge/index-execute',
      'Execute knowledge indexing task',
      {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['knowledge.reindex', 'knowledge.reconcile'] },
          full: { type: 'boolean' },
        },
        required: ['kind'],
        additionalProperties: false,
      },
      undefined,
      'none',
      'knowledge-internal',
    ),
    handlers.executeIndex,
  );
}

function definition(
  toolId: string,
  title: string,
  inputSchema: Record<string, unknown>,
  outputSchema: ToolDefinition['outputSchema'],
  sideEffects: ToolDefinition['sideEffects'],
  source: ToolDefinition['source'] = 'builtin',
): ToolDefinition {
  return {
    toolId,
    title,
    description: `GameCrafter Project knowledge: ${title.toLowerCase()}.`,
    inputSchema,
    ...(outputSchema ? { outputSchema } : {}),
    executionMode: 'project-file',
    sideEffects,
    evidence: 'Project knowledge records, citations, and index state.',
    capabilities: [`knowledge:${toolId}`],
    source,
  };
}
