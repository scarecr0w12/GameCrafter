import {
  ChangeRequestSchema,
  RpcError,
  RpcErrorCode,
  type ChangeRequest,
  type ImpactResult,
  type IntegrationRecord,
  type IntegrationStatus,
  type TaskCompletionContract,
  type TaskTouch,
  uuidv7,
} from '@gamecrafter/contracts';
import { compile } from '@gamecrafter/contracts';
import type { BoardService } from '../board/board-service';
import type { ProjectDatabases } from '../projects/project-databases';
import type { ProfileStore } from '../profile/profile-store';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import { ChangeGraph } from './change-graph';

const requestValidator = compile<ChangeRequest>(ChangeRequestSchema);

export interface ChangeRequestInput {
  projectId: string;
  text: string;
  role?: string;
  touches?: TaskTouch[];
  budget?: { maxCostUsd?: number; maxTokens?: number; maxDurationMs?: number };
}

export class ChangeService {
  constructor(
    private readonly projectDatabases: ProjectDatabases,
    private readonly projects: ProfileStore,
    private readonly tasks: TaskService,
    private readonly graphService: ChangeGraph,
    private readonly settings: SettingsService,
    private readonly board: BoardService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  request(input: ChangeRequestInput): ChangeRequest {
    const project = this.projects.getById(input.projectId);
    if (!project)
      throw new RpcError(`Project not found: ${input.projectId}`, RpcErrorCode.ProjectNotFound);
    const seeds = parseImpactSeeds(input.text);
    const threshold = Number(
      this.settings.resolve('coordination.impactConfidenceThreshold', {
        projectId: input.projectId,
      }).value,
    );
    const impactPreview: ImpactResult | null =
      seeds.length > 0 ? this.graphService.impact(input.projectId, seeds, { threshold }) : null;
    const required: TaskCompletionContract['required'] = ['generated'];
    const created = this.tasks.create({
      projectId: input.projectId,
      kind: 'agent.run',
      title: input.text.slice(0, 160) || 'Coordinate Project change',
      goal: input.text,
      role: input.role ?? 'coordinator',
      isolation: 'none',
      ...(input.touches === undefined ? {} : { touches: input.touches }),
      ...(input.budget === undefined ? {} : { budget: input.budget }),
      contract: { required, validators: [] },
      input: { requestText: input.text, impactPreview },
    });
    const thread = this.board.createThread(
      {
        projectId: input.projectId,
        title: input.text.trim().slice(0, 160) || 'Project change request',
        kind: 'discussion',
        tags: ['change-request'],
        links: [{ kind: 'task', ref: created.task.taskId }],
        body: input.text,
        type: 'comment',
      },
      { kind: 'user' },
    );
    const request = requestValidator.assert({
      schemaVersion: 1,
      requestId: uuidv7(),
      projectId: input.projectId,
      text: input.text,
      rootTaskId: created.task.taskId,
      threadId: thread.thread.threadId,
      impactPreview,
      createdAt: this.now().toISOString(),
    });
    this.projectDatabases
      .get(input.projectId)
      .prepare(
        `INSERT INTO change_requests (request_id, project_id, root_task_id, created_at, request_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        request.requestId,
        request.projectId,
        request.rootTaskId,
        request.createdAt,
        JSON.stringify(request),
      );
    return request;
  }

  requests(projectId: string, limit = 200): ChangeRequest[] {
    return this.projectDatabases
      .get(projectId)
      .prepare(
        `SELECT request_json AS requestJson FROM change_requests
         WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all<{ requestJson: string }>(projectId, limit)
      .map((row) => requestValidator.assert(JSON.parse(row.requestJson)));
  }

  integrations(projectId: string, status?: IntegrationStatus): IntegrationRecord[] {
    const rows = status
      ? this.projectDatabases
          .get(projectId)
          .prepare(
            `SELECT integration_json AS integrationJson FROM integrations
             WHERE project_id = ? AND status = ? ORDER BY updated_at DESC`,
          )
          .all<{ integrationJson: string }>(projectId, status)
      : this.projectDatabases
          .get(projectId)
          .prepare(
            `SELECT integration_json AS integrationJson FROM integrations
             WHERE project_id = ? ORDER BY updated_at DESC`,
          )
          .all<{ integrationJson: string }>(projectId);
    return rows.map((row) => JSON.parse(row.integrationJson) as IntegrationRecord);
  }

  integrationForTask(projectId: string, taskId: string): IntegrationRecord | undefined {
    const row = this.projectDatabases
      .get(projectId)
      .prepare(
        `SELECT integration_json AS integrationJson FROM integrations
         WHERE project_id = ? AND task_id = ?`,
      )
      .get<{ integrationJson: string }>(projectId, taskId);
    return row ? (JSON.parse(row.integrationJson) as IntegrationRecord) : undefined;
  }

  saveIntegration(integration: IntegrationRecord): IntegrationRecord {
    this.projectDatabases
      .get(integration.projectId)
      .prepare(
        `INSERT INTO integrations (integration_id, project_id, task_id, status, updated_at, integration_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, task_id) DO UPDATE SET
          integration_id = excluded.integration_id,
          status = excluded.status,
          updated_at = excluded.updated_at,
          integration_json = excluded.integration_json`,
      )
      .run(
        integration.integrationId,
        integration.projectId,
        integration.taskId,
        integration.status,
        integration.updatedAt,
        JSON.stringify(integration),
      );
    return integration;
  }

  integrate(projectId: string, taskId: string): IntegrationRecord {
    const integration = this.integrationForTask(projectId, taskId);
    if (!integration || integration.status !== 'ready') {
      throw new RpcError('Integration is not ready.', RpcErrorCode.IntegrationNotReady);
    }
    throw new RpcError('Git integration is not initialized.', RpcErrorCode.IntegrationNotReady);
  }

  abortIntegration(projectId: string, integrationId: string): IntegrationRecord {
    const integration = this.integrations(projectId).find(
      (candidate) => candidate.integrationId === integrationId,
    );
    if (!integration)
      throw new RpcError(
        `Integration not found: ${integrationId}`,
        RpcErrorCode.IntegrationNotReady,
      );
    return this.saveIntegration({
      ...integration,
      status: 'aborted',
      updatedAt: this.now().toISOString(),
    });
  }
}

export function parseImpactSeeds(text: string): string[] {
  const refs = new Set<string>();
  for (const match of text.matchAll(/\b[a-z][a-z0-9]*(?:\.[a-z0-9][a-z0-9-]*)+\b/g)) {
    refs.add(`canon:${match[0]}`);
  }
  for (const match of text.matchAll(/\b(?:docs|game)\/[A-Za-z0-9_./-]+/g)) {
    refs.add(`file:${match[0]!.replace(/\/$/, '')}`);
  }
  return [...refs].sort();
}
