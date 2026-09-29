import { RpcError, RpcErrorCode, type BindingDecision } from '@gamecrafter/contracts';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import type { BoardService } from './board-service';

export type BoardMaintenanceMode = 'audit' | 'cleanup' | 'sync';

export interface BoardMaintenanceSchedulerOptions {
  board: BoardService;
  tasks: TaskService;
  settings: SettingsService;
  now?: () => Date;
  tickIntervalMs?: number;
}

export class BoardMaintenanceScheduler {
  private readonly now: () => Date;
  private readonly tickIntervalMs: number;
  private timer?: NodeJS.Timeout;
  private ticking?: Promise<void>;
  private stopped = false;

  constructor(private readonly options: BoardMaintenanceSchedulerOptions) {
    this.now = options.now ?? (() => new Date());
    this.tickIntervalMs = options.tickIntervalMs ?? 60_000;
  }

  start(): void {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => void this.tick(), this.tickIntervalMs);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  scheduleManual(projectId: string, mode: BoardMaintenanceMode): string {
    return this.createTask(projectId, mode, `manual:${mode}`, { mode });
  }

  scheduleSync(decision: BindingDecision): string | undefined {
    if (!this.maintenanceEnabled(decision.projectId)) return undefined;
    return this.createTask(decision.projectId, 'sync', `binding:${decision.decisionId}`, {
      mode: 'sync',
      decisionId: decision.decisionId,
    });
  }

  retrySync(projectId: string, decision: BindingDecision): string {
    if (decision.syncStatus === 'conflict') {
      throw new RpcError(
        'Board decision has a canon sync conflict',
        RpcErrorCode.BoardSyncConflict,
      );
    }
    return this.createTask(
      projectId,
      'sync',
      `retry:${decision.decisionId}:${decision.syncAttempts}`,
      { mode: 'sync', decisionId: decision.decisionId, force: true },
    );
  }

  taskCompleted(projectId: string, mode: BoardMaintenanceMode, taskId: string): void {
    const now = this.now().toISOString();
    const state = this.options.board.maintenanceStatus(projectId);
    const interval = Number(
      this.options.settings.resolve('board.auditIntervalMinutes', { projectId }).value,
    );
    this.options.board.setMaintenanceState(projectId, {
      ...(mode === 'audit' ? { lastAuditAt: now } : {}),
      ...(mode === 'cleanup' ? { lastCleanupAt: now } : {}),
      ...(mode === 'audit'
        ? { nextAuditAt: new Date(this.now().getTime() + interval * 60_000).toISOString() }
        : { nextAuditAt: state.nextAuditAt }),
      runningTaskId: this.activeMaintenanceTask(projectId, taskId)?.taskId ?? null,
    });
    this.options.board.recordMaintenanceCompleted(projectId, mode, taskId);
  }

  taskFailed(projectId: string, taskId: string): void {
    this.options.board.setMaintenanceState(projectId, {
      runningTaskId: this.activeMaintenanceTask(projectId, taskId)?.taskId ?? null,
    });
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.ticking) return this.ticking;
    this.ticking = this.runTick().finally(() => {
      this.ticking = undefined;
    });
    return this.ticking;
  }

  private async runTick(): Promise<void> {
    for (const projectId of this.options.tasks.projectIds()) {
      if (this.stopped || !this.maintenanceEnabled(projectId)) continue;
      const state = this.options.board.maintenanceStatus(projectId);
      const interval = Math.max(
        1,
        Number(this.options.settings.resolve('board.auditIntervalMinutes', { projectId }).value) ||
          240,
      );
      if (!state.nextAuditAt) {
        this.options.board.setMaintenanceState(projectId, {
          nextAuditAt: new Date(this.now().getTime() + interval * 60_000).toISOString(),
        });
        continue;
      }
      if (Date.parse(state.nextAuditAt) > this.now().getTime()) continue;
      if (this.hasActiveMaintenanceTask(projectId)) continue;
      const nextAuditAt = new Date(this.now().getTime() + interval * 60_000).toISOString();
      this.options.board.setMaintenanceState(projectId, { nextAuditAt });
      this.createTask(projectId, 'audit', `periodic:${state.nextAuditAt}`, { mode: 'audit' });
    }
  }

  private createTask(
    projectId: string,
    mode: BoardMaintenanceMode,
    deduplicationKey: string,
    input: unknown,
  ): string {
    const created = this.options.tasks.create({
      projectId,
      kind: `board-maintenance.${mode}`,
      title: `Board ${mode}`,
      goal: `Run board maintenance ${deduplicationKey}`,
      input,
      assignee: { role: 'board-maintainer', accessCeiling: 'restricted' },
    });
    this.options.board.setMaintenanceState(projectId, { runningTaskId: created.task.taskId });
    return created.task.taskId;
  }

  private maintenanceEnabled(projectId: string): boolean {
    return this.options.settings.resolve('board.maintenanceEnabled', { projectId }).value === true;
  }

  private hasActiveMaintenanceTask(projectId: string): boolean {
    return this.activeMaintenanceTask(projectId) !== undefined;
  }

  private activeMaintenanceTask(projectId: string, excludingTaskId?: string) {
    return this.options.tasks
      .list(projectId, {
        states: ['ready', 'claimed', 'running', 'waiting_input'],
        limit: 1_000,
      })
      .find(
        (task) => task.kind.startsWith('board-maintenance.') && task.taskId !== excludingTaskId,
      );
  }
}
