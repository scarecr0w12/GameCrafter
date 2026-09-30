import { Type } from '@sinclair/typebox';
import {
  ChangeNodeRefSchema,
  ImpactResultSchema,
  IntegrationRecordSchema,
  IntegrationStatusSchema,
  type ChangeNodeRef,
  type IntegrationStatus,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ChangeGraph } from './change-graph';
import { ChangeService } from './change-service';
import { IntegrationService } from './integration-service';
import { ToolRegistry } from '../tools/tool-registry';

export function registerChangeTools(
  registry: ToolRegistry,
  graph: ChangeGraph,
  changes: ChangeService,
  integrations: IntegrationService,
): void {
  registry.register(
    definition(
      'change/impact',
      'Analyze change impact',
      'Trace likely dependent canon, files, scenes, assets, tests, and tasks from seed references.',
      Type.Object(
        {
          seeds: Type.Array(ChangeNodeRefSchema, { minItems: 1 }),
          maxDepth: Type.Optional(Type.Integer({ minimum: 0 })),
          threshold: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
        },
        { additionalProperties: false },
      ),
      ImpactResultSchema,
    ),
    (context, input) => {
      const args = asRecord(input);
      const seeds = Array.isArray(args.seeds) ? (args.seeds as string[]) : [];
      return {
        output: graph.impact(context.projectId, seeds as ChangeNodeRef[], {
          maxDepth: typeof args.maxDepth === 'number' ? args.maxDepth : undefined,
          threshold: typeof args.threshold === 'number' ? args.threshold : undefined,
        }),
      };
    },
  );

  registry.register(
    definition(
      'change/integrations',
      'List task integrations',
      'Inspect validation, conflicts, and integration state for this Project.',
      Type.Object(
        { status: Type.Optional(IntegrationStatusSchema) },
        { additionalProperties: false },
      ),
      Type.Object(
        { integrations: Type.Array(IntegrationRecordSchema) },
        { additionalProperties: false },
      ),
    ),
    (context, input) => {
      const status = asRecord(input).status;
      return {
        output: {
          integrations: changes.integrations(
            context.projectId,
            typeof status === 'string' ? (status as IntegrationStatus) : undefined,
          ),
        },
      };
    },
  );

  registry.register(
    definition(
      'change/integrate',
      'Integrate task changes',
      'Merge a validated task branch into the Project branch after a clean-worktree check.',
      Type.Object({ taskId: Type.String({ format: 'uuid' }) }, { additionalProperties: false }),
      IntegrationRecordSchema,
      'workspace-write',
      'change-internal',
    ),
    async (context, input) => ({
      output: await integrations.integrate(context.projectId, String(asRecord(input).taskId)),
    }),
  );

  registry.register(
    definition(
      'change/abortIntegration',
      'Abort task integration',
      'Abort a pending task integration and remove its isolated worktree.',
      Type.Object(
        { integrationId: Type.String({ format: 'uuid' }) },
        { additionalProperties: false },
      ),
      IntegrationRecordSchema,
      'internal-write',
      'change-internal',
    ),
    async (context, input) => ({
      output: await integrations.abort(context.projectId, String(asRecord(input).integrationId)),
    }),
  );
}

function definition(
  toolId: string,
  title: string,
  description: string,
  inputSchema: unknown,
  outputSchema: unknown,
  sideEffects: ToolDefinition['sideEffects'] = 'none',
  source = 'agent-runtime',
): ToolDefinition {
  return {
    toolId,
    title,
    description,
    inputSchema,
    outputSchema,
    executionMode: 'project-file',
    sideEffects,
    evidence: 'Change graph impact and integration records.',
    capabilities: ['change.graph.read'],
    source,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
