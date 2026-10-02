import {
  SkillActivationResultSchema,
  SkillCatalogEntrySchema,
  SkillResourceReadResultSchema,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry } from '../tools/tool-registry';
import { SkillService } from './skill-service';

export function registerSkillTools(registry: ToolRegistry, skills: SkillService): void {
  registry.register(
    skillToolDefinition(
      'skills/activate',
      'Activate skill',
      'Load the instructions for an eligible skill into the current task context.',
      {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
      SkillActivationResultSchema,
      'Returns skill instructions and resource paths without reading the resources.',
    ),
    async (context, input) => {
      const name = String(asRecord(input).name);
      const result = await skills.activate(
        context.projectId,
        name,
        context.taskId ?? undefined,
        context.agentId ?? undefined,
        undefined,
        context.accessMode,
      );
      return {
        output: result,
        evidence: [{ kind: 'skill', ref: `${name}@${result.version ?? 'unversioned'}` }],
      };
    },
  );
  registry.register(
    skillToolDefinition(
      'skills/search',
      'Search skills',
      'Find additional eligible skills for the current task.',
      {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: { entries: { type: 'array', items: SkillCatalogEntrySchema } },
        required: ['entries'],
        additionalProperties: false,
      },
      'Returns names, descriptions, locations, versions, and relevance scores for eligible skills.',
    ),
    (context, input) => ({
      output: {
        entries: skills.searchForTask(
          context.projectId,
          String(asRecord(input).query),
          context.taskId ?? undefined,
          context.accessMode,
        ),
      },
    }),
  );
  registry.register(
    skillToolDefinition(
      'skills/read-resource',
      'Read skill reference',
      'Read a bounded page of an eligible skill instruction or supporting text resource.',
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          resource: { type: 'string' },
          startLine: { type: 'integer', minimum: 1 },
          maxLines: { type: 'integer', minimum: 1, maximum: 500 },
        },
        required: ['name', 'resource'],
        additionalProperties: false,
      },
      SkillResourceReadResultSchema,
      'Returns bounded UTF-8 text and the skill hash; does not execute resource scripts.',
    ),
    (context, input) => {
      const value = asRecord(input);
      const output = skills.readResource(
        {
          projectId: context.projectId,
          name: String(value.name),
          resource: String(value.resource),
          taskId: context.taskId ?? undefined,
          startLine: value.startLine as number | undefined,
          maxLines: value.maxLines as number | undefined,
        },
        undefined,
        context.accessMode,
      );
      return {
        output,
        evidence: [
          { kind: 'skill-resource', ref: `${output.name}/${output.resource}@${output.hash}` },
        ],
      };
    },
  );
}

function skillToolDefinition(
  toolId: string,
  title: string,
  description: string,
  inputSchema: unknown,
  outputSchema: unknown,
  evidence: string,
): ToolDefinition {
  return {
    toolId,
    title,
    description,
    inputSchema,
    outputSchema,
    executionMode: 'project-file',
    sideEffects: 'none',
    evidence,
    capabilities: ['skills.read'],
    source: 'builtin',
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Skill tool input must be an object.');
  }
  return input as Record<string, unknown>;
}
