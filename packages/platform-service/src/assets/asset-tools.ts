import { Type } from '@sinclair/typebox';
import {
  AssetFileEntrySchema,
  AssetJobRequestSchema,
  AssetJobSchema,
  AssetJobStatusSchema,
  AssetPreviewSchema,
  type AssetFileEntry,
  type AssetJob,
  type AssetJobRequest,
  type AssetJobStatus,
  type AssetPreview,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';

export interface AssetToolHandlers {
  generate(
    projectId: string,
    accountId: string,
    request: AssetJobRequest,
    taskId?: string,
  ): Promise<AssetJob>;
  job(projectId: string, jobId: string): AssetJob;
  jobs(projectId: string, limit?: number, status?: AssetJobStatus): AssetJob[];
  importAsset(
    projectId: string,
    jobId: string,
    artifactId: string,
    destinationDir?: string,
  ): Promise<{ job: AssetJob; importedPath: string; provenancePath: string }>;
  files(projectId: string, directory?: string): AssetFileEntry[];
  preview(projectId: string, sourcePath: string, refresh?: boolean): AssetPreview;
}

export function registerAssetTools(registry: ToolRegistry, handlers: AssetToolHandlers): void {
  const definitions: ToolDefinition[] = [
    {
      toolId: 'asset/generate',
      title: 'Generate 3D asset',
      description: 'Submit a paid Meshy or Tripo3D asset generation job for this Project.',
      inputSchema: Type.Object(
        {
          accountId: Type.String({ format: 'uuid' }),
          request: AssetJobRequestSchema,
          taskId: Type.Optional(Type.String({ format: 'uuid' })),
        },
        { additionalProperties: false },
      ),
      outputSchema: AssetJobSchema,
      executionMode: 'headless-process',
      sideEffects: 'paid',
      evidence: 'External provider task ID and generated asset artifact records.',
      capabilities: ['asset:generate'],
      source: 'builtin',
    },
    {
      toolId: 'asset/job',
      title: 'Get asset job',
      description: 'Read one asset generation job in this Project.',
      inputSchema: Type.Object(
        { jobId: Type.String({ format: 'uuid' }) },
        { additionalProperties: false },
      ),
      outputSchema: AssetJobSchema,
      executionMode: 'project-file',
      sideEffects: 'none',
      evidence: 'Asset job record.',
      capabilities: ['asset:read'],
      source: 'builtin',
    },
    {
      toolId: 'asset/jobs',
      title: 'List asset jobs',
      description: 'List recent asset generation jobs in this Project.',
      inputSchema: Type.Object(
        {
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
          status: Type.Optional(AssetJobStatusSchema),
        },
        { additionalProperties: false },
      ),
      outputSchema: Type.Object(
        { jobs: Type.Array(AssetJobSchema) },
        { additionalProperties: false },
      ),
      executionMode: 'project-file',
      sideEffects: 'none',
      evidence: 'Asset job records.',
      capabilities: ['asset:read'],
      source: 'builtin',
    },
    {
      toolId: 'asset/import',
      title: 'Import approved asset',
      description: 'Copy a reviewed, approved asset into this Project with provenance.',
      inputSchema: Type.Object(
        {
          jobId: Type.String({ format: 'uuid' }),
          artifactId: Type.String({ format: 'uuid' }),
          destinationDir: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: false },
      ),
      executionMode: 'headless-process',
      sideEffects: 'workspace-write',
      evidence: 'Imported asset path and provenance sidecar.',
      capabilities: ['asset:import'],
      source: 'builtin',
    },
    {
      toolId: 'asset/preview',
      title: 'Preview asset',
      description: 'Create or reuse a disposable image or glTF preview derivative.',
      inputSchema: Type.Object(
        { path: Type.String({ minLength: 1 }), refresh: Type.Optional(Type.Boolean()) },
        { additionalProperties: false },
      ),
      outputSchema: AssetPreviewSchema,
      executionMode: 'project-file',
      sideEffects: 'internal-write',
      evidence: 'Asset preview metadata and source hash.',
      capabilities: ['asset:preview'],
      source: 'builtin',
    },
    {
      toolId: 'asset/files',
      title: 'List Project assets',
      description: 'List files under game/assets and their provenance sidecars.',
      inputSchema: Type.Object(
        { directory: Type.Optional(Type.String()) },
        { additionalProperties: false },
      ),
      outputSchema: Type.Object(
        { files: Type.Array(AssetFileEntrySchema) },
        { additionalProperties: false },
      ),
      executionMode: 'project-file',
      sideEffects: 'none',
      evidence: 'Project asset file paths and provenance links.',
      capabilities: ['asset:read'],
      source: 'builtin',
    },
  ];
  for (const definition of definitions) {
    registry.register(definition, (context, input) =>
      runTool(definition.toolId, handlers, context, input),
    );
  }
}

async function runTool(
  toolId: string,
  handlers: AssetToolHandlers,
  context: ToolContext,
  input: unknown,
): Promise<{ output: unknown; evidence?: Array<{ kind: string; ref: string }> }> {
  const args = isRecord(input) ? input : {};
  if (toolId === 'asset/generate') {
    const job = await handlers.generate(
      context.projectId,
      String(args.accountId),
      args.request as AssetJobRequest,
      typeof args.taskId === 'string' ? args.taskId : (context.taskId ?? undefined),
    );
    return { output: job, evidence: [{ kind: 'asset-job', ref: job.jobId }] };
  }
  if (toolId === 'asset/job') {
    return { output: handlers.job(context.projectId, String(args.jobId)) };
  }
  if (toolId === 'asset/jobs') {
    return {
      output: {
        jobs: handlers.jobs(
          context.projectId,
          typeof args.limit === 'number' ? args.limit : undefined,
          isAssetJobStatus(args.status) ? args.status : undefined,
        ),
      },
    };
  }
  if (toolId === 'asset/import') {
    const result = await handlers.importAsset(
      context.projectId,
      String(args.jobId),
      String(args.artifactId),
      typeof args.destinationDir === 'string' ? args.destinationDir : undefined,
    );
    return { output: result, evidence: [{ kind: 'asset-import', ref: result.importedPath }] };
  }
  if (toolId === 'asset/preview') {
    const preview = handlers.preview(context.projectId, String(args.path), args.refresh === true);
    return { output: preview, evidence: [{ kind: 'asset-preview', ref: preview.previewId }] };
  }
  if (toolId === 'asset/files') {
    return {
      output: {
        files: handlers.files(
          context.projectId,
          typeof args.directory === 'string' ? args.directory : undefined,
        ),
      },
    };
  }
  throw new Error(`Unknown asset tool: ${toolId}`);
}

function isAssetJobStatus(value: unknown): value is AssetJobStatus {
  return (
    value === 'queued' ||
    value === 'submitted' ||
    value === 'running' ||
    value === 'downloading' ||
    value === 'review' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'imported' ||
    value === 'failed' ||
    value === 'cancelled' ||
    value === 'expired'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
