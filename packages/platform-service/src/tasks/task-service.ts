import { existsSync } from 'node:fs';
import path from 'node:path';
import type { TaskCreateInput, TaskEvent, TaskQuestion, TaskRecord } from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { SettingsService } from '../settings/settings-service';
import { HandlerRegistry } from '../workers/handler-registry';
import { TaskGraph, type CreatedTask } from './task-graph';
import { TaskStore, type TaskEventFilter, type TaskListFilter } from './task-store';

export interface ProjectTaskRuntime {
  projectId: string;
  store: TaskStore;
  graph: TaskGraph;
}

export interface TaskSupervisorPort {
  schedule(): Promise<void>;
  cancelTask(projectId: string, taskId: string): Promise<void>;
  answerTask(projectId: string, taskId: string, questionId: string, answer: unknown): Promise<void>;
}

export interface TaskServiceEvents {
  taskChanged(projectId: string, task: TaskRecord): void;
  taskEvent(projectId: string, event: TaskEvent): void;
  taskQuestion(projectId: string, question: TaskQuestion): void;
}

export class TaskService {
  private readonly runtimes = new Map<string, ProjectTaskRuntime>();
  private supervisor?: TaskSupervisorPort;

  constructor(
    private readonly profile: ProfileStore,
    private readonly projectDatabases: ProjectDatabases,
    private readonly settings: SettingsService,
    private readonly handlers: HandlerRegistry,
    private readonly events: TaskServiceEvents,
  ) {}

  setSupervisor(supervisor: TaskSupervisorPort): void {
    this.supervisor = supervisor;
  }

  projectIds(): string[] {
    return this.profile
      .list()
      .filter(
        (project) =>
          existsSync(project.path) &&
          existsSync(path.join(project.path, 'gamecrafter.project.json')),
      )
      .map((project) => project.projectId);
  }

  runtime(projectId: string): ProjectTaskRuntime {
    const existing = this.runtimes.get(projectId);
    if (existing) return existing;

    const store = new TaskStore(this.projectDatabases.get(projectId));
    const graph = new TaskGraph({
      projectId,
      store,
      settings: this.settings,
      handlers: this.handlers,
      onTaskChanged: (task) => this.events.taskChanged(projectId, task),
      onTaskEvent: (event) => this.events.taskEvent(projectId, event),
      onQuestion: (question) => this.events.taskQuestion(projectId, question),
      onTaskTerminal: (task) => {
        graph.onTaskTerminal(task);
        void this.supervisor?.schedule();
      },
      onCancelTask: (taskId) => this.supervisor?.cancelTask(projectId, taskId),
    });
    const runtime = { projectId, store, graph };
    this.runtimes.set(projectId, runtime);
    return runtime;
  }

  create(input: TaskCreateInput): CreatedTask {
    const result = this.runtime(input.projectId).graph.create(input);
    void this.supervisor?.schedule();
    return result;
  }

  get(projectId: string, taskId: string): TaskRecord {
    return this.runtime(projectId).graph.get(taskId);
  }

  list(projectId: string, filter: TaskListFilter = {}): TaskRecord[] {
    return this.runtime(projectId).graph.list(filter);
  }

  tree(projectId: string, rootTaskId: string): TaskRecord[] {
    return this.runtime(projectId).graph.tree(rootTaskId);
  }

  async cancel(
    projectId: string,
    taskId: string,
    reason?: string,
  ): Promise<{ cancelled: string[] }> {
    const cancelled = await this.runtime(projectId).graph.cancel(taskId, reason);
    void this.supervisor?.schedule();
    return { cancelled };
  }

  eventsForProject(projectId: string, filter: TaskEventFilter = {}): TaskEvent[] {
    return this.runtime(projectId).graph.events(filter);
  }

  async answer(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<TaskRecord> {
    const task = this.runtime(projectId).graph.answerQuestion(taskId, questionId, answer);
    await this.supervisor?.answerTask(projectId, taskId, questionId, answer);
    return task;
  }

  questions(pendingOnly = false): TaskQuestion[] {
    return this.projectIds()
      .flatMap((projectId) => this.runtime(projectId).graph.questions(pendingOnly))
      .sort((left, right) => left.askedAt.localeCompare(right.askedAt));
  }
}
