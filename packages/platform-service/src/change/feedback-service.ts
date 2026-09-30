import {
  RpcError,
  RpcErrorCode,
  TaskEventKind,
  type ChangeNodeRef,
  type FeedbackInput,
  type TaskRecord,
  type TaskTouch,
} from '@gamecrafter/contracts';
import type { BoardService } from '../board/board-service';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import { ChangeGraph } from './change-graph';
import { ChangeService } from './change-service';
import { IntegrationService } from './integration-service';

export interface FeedbackResult {
  reopenedTaskIds: string[];
  revalidateTaskIds: string[];
  threadId: string | null;
}

export interface FeedbackServiceOptions {
  tasks: TaskService;
  changes: ChangeService;
  graph: ChangeGraph;
  integrations: IntegrationService;
  board: BoardService;
  settings: SettingsService;
}

export class FeedbackService {
  constructor(private readonly options: FeedbackServiceOptions) {}

  async apply(input: FeedbackInput): Promise<FeedbackResult> {
    const task = this.resolveTask(input);
    if (!task && (input.target.kind !== 'thread' || input.decision !== 'accept')) {
      throw new RpcError(
        'Feedback target task or artifact was not found.',
        RpcErrorCode.TaskNotFound,
      );
    }
    const changeRequest = task
      ? this.options.changes
          .requests(input.projectId)
          .find((request) => request.rootTaskId === task.rootTaskId)
      : undefined;
    let threadId =
      input.target.kind === 'thread' ? input.target.ref : (changeRequest?.threadId ?? null);
    const reopenedTaskIds: string[] = [];
    const revalidateTaskIds: string[] = [];

    if (task) {
      this.recordTaskFeedback(task, input);
      if (input.decision !== 'accept') {
        const attempt = this.options.tasks.createAttempt(task, input.note);
        reopenedTaskIds.push(attempt.taskId);
        if (input.decision === 'reject') {
          const integration = this.options.changes.integrationForTask(input.projectId, task.taskId);
          if (integration?.status === 'integrated' && integration.mergeCommit) {
            await this.options.integrations.createRevertIntegration(task, integration, input.note);
          }
        }
        revalidateTaskIds.push(...this.createRevalidationTasks(task, input.note));
      }
    }

    const links = [
      ...(task ? [{ kind: 'task' as const, ref: task.taskId }] : []),
      ...(input.target.kind === 'artifact'
        ? [{ kind: 'artifact' as const, ref: input.target.ref }]
        : []),
    ];
    const body = `Feedback ${input.decision}${task ? ` on task ${task.taskId}` : ''}.\n\n${input.note}`;
    if (threadId) {
      this.options.board.post(
        { projectId: input.projectId, threadId, type: 'comment', body, links },
        { kind: 'user' },
      );
    } else {
      const created = this.options.board.createThread(
        {
          projectId: input.projectId,
          title: `Feedback: ${task?.title ?? input.target.ref}`,
          kind: 'discussion',
          tags: ['feedback'],
          links,
          body,
          type: 'comment',
        },
        { kind: 'user' },
      );
      threadId = created.thread.threadId;
    }
    return { reopenedTaskIds, revalidateTaskIds, threadId };
  }

  private resolveTask(input: FeedbackInput): TaskRecord | undefined {
    if (input.target.kind === 'task') {
      return this.options.tasks.get(input.projectId, input.target.ref);
    }
    if (input.target.kind === 'artifact') {
      return this.options.tasks.list(input.projectId, { limit: 5_000 }).find((task) =>
        task.result?.artifacts.some((artifact) => {
          const targetRef = input.target.ref.replace(/^file:/, '');
          return artifact.path === targetRef || artifact.uri === input.target.ref;
        }),
      );
    }
    const thread = this.options.board.thread(input.projectId, input.target.ref, {
      includeMessages: true,
    });
    const taskRef = [
      ...thread.thread.links,
      ...thread.messages.flatMap((message) => message.links),
    ].find((link) => link.kind === 'task')?.ref;
    if (!taskRef) return undefined;
    return this.options.tasks.get(input.projectId, taskRef);
  }

  private recordTaskFeedback(task: TaskRecord, input: FeedbackInput): void {
    const reviewStatus =
      input.decision === 'accept'
        ? 'accepted'
        : input.decision === 'reject'
          ? 'rejected'
          : 'revision-requested';
    const graph = this.options.tasks.runtime(input.projectId).graph;
    if (task.result) {
      graph.update(task.taskId, {
        result: { ...task.result, reviewStatus },
      });
    }
    graph.appendEvent(
      task.taskId,
      TaskEventKind.Feedback,
      { decision: input.decision, note: input.note, reviewStatus },
      'user',
    );
  }

  private createRevalidationTasks(task: TaskRecord, note: string): string[] {
    const seeds = new Set<ChangeNodeRef>();
    for (const touch of task.touches ?? []) seeds.add(touch.resource);
    for (const artifact of task.result?.artifacts ?? []) {
      const ref = artifact.path ?? artifact.uri;
      if (!ref) continue;
      seeds.add(asChangeRef(artifact.kind === 'asset' ? 'asset' : 'file', ref));
    }
    if (seeds.size === 0) seeds.add(`task:${task.taskId}` as ChangeNodeRef);
    this.options.graph.rebuildGraph(task.projectId);
    const threshold = Number(
      this.options.settings.resolve('coordination.impactConfidenceThreshold', {
        projectId: task.projectId,
      }).value,
    );
    const impact = this.options.graph.impact(task.projectId, [...seeds], { threshold });
    const affected = impact.nodes.filter(
      (entry) =>
        entry.depth > 0 &&
        entry.pathConfidence >= threshold &&
        entry.node.nodeId !== `task:${task.taskId}` &&
        (entry.node.kind === 'task' || entry.node.kind === 'canon'),
    );
    const created = new Set<string>();
    for (const entry of affected) {
      const revalidatesTask = entry.node.kind === 'task' ? entry.node.ref : undefined;
      const parentTask = revalidatesTask
        ? this.options.tasks.get(task.projectId, revalidatesTask)
        : undefined;
      const touches: TaskTouch[] = [
        {
          resource: entry.node.nodeId as ChangeNodeRef,
          intent: 'read',
        },
      ];
      const createdTask = this.options.tasks.create({
        projectId: task.projectId,
        kind: 'agent.run',
        title: `Revalidate ${entry.node.title}`,
        goal: `Revalidate ${entry.node.title} after feedback on task ${task.taskId}.`,
        parentTaskId: task.parentTaskId ?? task.taskId,
        role: 'validator',
        touches,
        contract: { required: ['tool-validation'], validators: [] },
        input: {
          revalidatesTaskId: revalidatesTask,
          targetRef: entry.node.nodeId,
          sourceTaskId: task.taskId,
          feedback: note,
          pathConfidence: entry.pathConfidence,
        },
        ...(parentTask?.assignee?.accessCeiling
          ? { assignee: { role: 'validator', accessCeiling: parentTask.assignee.accessCeiling } }
          : {}),
      });
      created.add(createdTask.task.taskId);
    }
    return [...created];
  }
}

function asChangeRef(kind: string, ref: string): ChangeNodeRef {
  return ref.includes(':') ? (ref as ChangeNodeRef) : (`${kind}:${ref}` as ChangeNodeRef);
}
