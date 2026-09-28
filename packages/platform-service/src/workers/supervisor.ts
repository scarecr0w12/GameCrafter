import { fork, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { RpcErrorCode, TaskEventKind, uuidv7 } from '@gamecrafter/contracts';
import type { TaskError, TaskRecord } from '@gamecrafter/contracts';
import { SettingsService } from '../settings/settings-service';
import type { TaskSupervisorPort } from '../tasks/task-service';
import type { ProjectTaskRuntime, TaskService } from '../tasks/task-service';
import type { ToolBroker } from '../tools/tool-broker';
import type { HandlerRegistry } from './handler-registry';
import type { WorkerCommand, WorkerMessage } from './types';

interface RunningWorker {
  projectId: string;
  taskId: string;
  workerId: string;
  child: ChildProcess;
  exitPromise: Promise<void>;
  resolveExit: () => void;
  stopRequested: boolean;
  finalMessage: boolean;
  answerAcks: Map<string, (received: boolean) => void>;
  toolCalls: Map<string, AbortController>;
  cancelTimer?: NodeJS.Timeout;
}

export interface WorkerSupervisorOptions {
  tasks: TaskService;
  settings: SettingsService;
  handlers: HandlerRegistry;
  tools?: ToolBroker;
  now?: () => Date;
  leaseTtlMs?: number;
  tickIntervalMs?: number;
  workerMainPath?: string;
  onWorkerStarted?: (taskId: string, pid: number) => void;
}

export class WorkerSupervisor implements TaskSupervisorPort {
  private readonly workers = new Map<string, RunningWorker>();
  private readonly retryAfter = new Map<string, number>();
  private readonly now: () => Date;
  private readonly leaseTtlMs: number;
  private readonly tickIntervalMs: number;
  private readonly workerMainPath: string;
  private timer?: NodeJS.Timeout;
  private scheduling?: Promise<void>;
  private stopping?: Promise<void>;
  private disposed = false;

  constructor(private readonly options: WorkerSupervisorOptions) {
    this.now = options.now ?? (() => new Date());
    this.leaseTtlMs = options.leaseTtlMs ?? 30_000;
    this.tickIntervalMs = options.tickIntervalMs ?? 1_000;
    this.workerMainPath = options.workerMainPath ?? resolveWorkerMain();
  }

  start(): void {
    if (this.timer || this.disposed) return;
    this.timer = setInterval(() => void this.schedule(), this.tickIntervalMs);
    this.timer.unref();
    void this.schedule();
  }

  schedule(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.scheduling) return this.scheduling;
    this.scheduling = this.scheduleTasks().finally(() => {
      this.scheduling = undefined;
    });
    return this.scheduling;
  }

  async answerTask(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<void> {
    const worker = this.workers.get(taskId);
    if (worker && worker.projectId === projectId && !worker.stopRequested) {
      let resolveAcknowledgement: (received: boolean) => void = () => undefined;
      const acknowledgement = new Promise<boolean>((resolve) => {
        resolveAcknowledgement = resolve;
      });
      worker.answerAcks.set(questionId, resolveAcknowledgement);
      const timeout = setTimeout(() => resolveAcknowledgement(false), 1_000);
      this.send(worker.child, { type: 'answer', questionId, answer });
      const received = await acknowledgement;
      clearTimeout(timeout);
      worker.answerAcks.delete(questionId);
      if (!received) await this.cancelTask(projectId, taskId);
    }
    await this.schedule();
  }

  async cancelTask(_projectId: string, taskId: string): Promise<void> {
    const worker = this.workers.get(taskId);
    if (!worker || worker.stopRequested) return;
    worker.stopRequested = true;
    for (const controller of worker.toolCalls.values()) controller.abort('task_cancelled');
    this.send(worker.child, { type: 'cancel' });
    worker.cancelTimer = setTimeout(() => worker.child.kill('SIGKILL'), 2_000);
    worker.cancelTimer.unref();
    await Promise.race([worker.exitPromise, delay(2_500)]);
    if (worker.child.exitCode === null && worker.child.signalCode === null) {
      worker.child.kill('SIGKILL');
    }
  }

  recoverOnStart(): void {
    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      for (const task of runtime.store.list({ states: ['claimed', 'running'] })) {
        runtime.graph.transition(task.taskId, 'ready', 'service_restart', 'service', {
          lease: null,
        });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: 'service_restart' },
          'service',
        );
      }
      for (const task of runtime.store.list({ states: ['waiting_input'] })) {
        if (task.lease) runtime.graph.update(task.taskId, { lease: null });
      }
    }
  }

  stopAll(options: { checkpoint: boolean }): Promise<void> {
    if (this.stopping) return this.stopping;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stopping = this.shutdown(options.checkpoint);
    return this.stopping;
  }

  private async scheduleTasks(): Promise<void> {
    const expiredLeases = await this.expireLeases();
    await this.enforceDurationBudgets();
    if (this.disposed) return;

    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      let maxConcurrent: number;
      try {
        maxConcurrent = Number(
          this.options.settings.resolve('agents.maxConcurrentPerProject', { projectId }).value,
        );
      } catch {
        maxConcurrent = 8;
      }
      maxConcurrent = Math.max(1, Math.floor(maxConcurrent) || 8);
      let active = [...this.workers.values()].filter(
        (worker) => worker.projectId === projectId && !worker.stopRequested,
      ).length;
      if (active >= maxConcurrent) continue;

      const candidates = runtime.store
        .list({ states: ['ready', 'running'], limit: 1_000 })
        .filter(
          (task) =>
            (task.state === 'ready' ||
              (task.state === 'running' && !this.workers.has(task.taskId))) &&
            !expiredLeases.has(task.taskId) &&
            (this.retryAfter.get(task.taskId) ?? 0) <= this.now().getTime(),
        )
        .sort(
          (left, right) =>
            right.priority - left.priority ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.taskId.localeCompare(right.taskId),
        );
      for (const task of candidates) {
        if (this.disposed || active >= maxConcurrent) break;
        if (this.workers.has(task.taskId)) continue;
        await this.startTask(runtime, task);
        if (this.workers.has(task.taskId)) active += 1;
      }
    }
  }

  private async startTask(runtime: ProjectTaskRuntime, original: TaskRecord): Promise<void> {
    this.retryAfter.delete(original.taskId);
    const handler = this.options.handlers.get(original.kind);
    if (!handler) {
      const error: TaskError = {
        message: `Unknown task kind: ${original.kind}`,
        code: String(RpcErrorCode.UnknownTaskKind),
        retryable: false,
      };
      runtime.graph.transition(original.taskId, 'blocked', 'unknown_task_kind', 'service', {
        error,
        finishedAt: this.now().toISOString(),
      });
      runtime.graph.appendEvent(original.taskId, TaskEventKind.Failed, { error }, 'service');
      return;
    }

    const workerId = uuidv7();
    const lease = {
      workerId,
      expiresAt: new Date(this.now().getTime() + this.leaseTtlMs).toISOString(),
    };
    let task = runtime.graph.get(original.taskId);
    if (task.state === 'ready') {
      task = runtime.graph.transition(task.taskId, 'claimed', 'worker_claimed', 'scheduler', {
        lease,
      });
      runtime.graph.appendEvent(
        task.taskId,
        TaskEventKind.Claimed,
        { workerId, attempt: task.attempt },
        'scheduler',
      );
    } else if (task.state === 'running') {
      task = runtime.graph.update(task.taskId, {
        lease,
        startedAt: task.startedAt ?? this.now().toISOString(),
      });
    } else {
      return;
    }

    let child: ChildProcess;
    try {
      child = fork(this.workerMainPath, [], {
        env: process.env,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
    } catch (error) {
      if (task.state === 'claimed') {
        runtime.graph.transition(task.taskId, 'ready', 'worker_start_failed', 'scheduler', {
          lease: null,
        });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: error instanceof Error ? error.message : String(error) },
          'scheduler',
        );
      } else {
        runtime.graph.fail(task.taskId, {
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        });
      }
      return;
    }

    let resolveExit: () => void = () => undefined;
    const exitPromise = new Promise<void>((resolve) => {
      resolveExit = resolve;
    });
    const worker: RunningWorker = {
      projectId: runtime.projectId,
      taskId: task.taskId,
      workerId,
      child,
      exitPromise,
      resolveExit,
      stopRequested: false,
      finalMessage: false,
      answerAcks: new Map(),
      toolCalls: new Map(),
    };
    this.workers.set(task.taskId, worker);
    child.on('message', (message: WorkerMessage) => {
      void this.onWorkerMessage(runtime, worker, message);
    });
    child.once('error', (error) => {
      void this.onWorkerError(runtime, worker, error);
    });
    child.once('exit', (code, signal) => {
      void this.onWorkerExit(runtime, worker, code, signal);
    });

    if (task.state === 'claimed') {
      task = runtime.graph.transition(task.taskId, 'running', 'worker_started', 'scheduler', {
        lease,
        startedAt: task.startedAt ?? this.now().toISOString(),
      });
    }
    if (child.pid !== undefined) this.options.onWorkerStarted?.(task.taskId, child.pid);
    const command: WorkerCommand = {
      type: 'run',
      task,
      handler,
      input: task.input,
      checkpoint: task.checkpoint,
    };
    this.send(child, command);
  }

  private async onWorkerMessage(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    message: WorkerMessage,
  ): Promise<void> {
    if (message.type === 'heartbeat') {
      if (worker.stopRequested) return;
      const task = runtime.store.get(worker.taskId);
      if (!task || (task.state !== 'claimed' && task.state !== 'running')) return;
      runtime.store.update(worker.taskId, {
        lease: {
          workerId: worker.workerId,
          expiresAt: new Date(this.now().getTime() + this.leaseTtlMs).toISOString(),
        },
      });
      return;
    }

    if (message.type === 'checkpoint') {
      const task = runtime.store.get(worker.taskId);
      if (task && (task.state === 'running' || task.state === 'waiting_input')) {
        runtime.graph.update(worker.taskId, { checkpoint: message.checkpoint });
        runtime.graph.appendEvent(
          worker.taskId,
          TaskEventKind.Checkpoint,
          { checkpoint: message.checkpoint },
          'worker',
        );
      }
      this.send(worker.child, { type: 'checkpoint-ack', requestId: message.requestId });
      return;
    }

    if (message.type === 'answer-received') {
      worker.answerAcks.get(message.questionId)?.(true);
      worker.answerAcks.delete(message.questionId);
      return;
    }

    if (worker.stopRequested || this.disposed) {
      if (message.type === 'stopped') return;
      return;
    }

    if (message.type === 'tool-call') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      const controller = new AbortController();
      worker.toolCalls.set(message.requestId, controller);
      void this.runWorkerToolCall(runtime, worker, task, message, controller);
      return;
    }

    if (message.type === 'progress') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      if (message.usage) {
        runtime.graph.update(worker.taskId, {
          spent: {
            costUsd: task.spent.costUsd + (message.usage.costUsd ?? 0),
            tokens: task.spent.tokens + (message.usage.tokens ?? 0),
          },
        });
      }
      runtime.graph.appendEvent(
        worker.taskId,
        TaskEventKind.Progress,
        {
          message: message.message,
          ...(message.percent === undefined ? {} : { percent: message.percent }),
          ...(message.usage ? { usage: message.usage } : {}),
        },
        'worker',
      );
      return;
    }

    if (message.type === 'question') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      runtime.graph.addQuestion(worker.taskId, message.prompt, message.options);
      return;
    }

    if (message.type === 'result') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      worker.finalMessage = true;
      runtime.graph.complete(worker.taskId, message.result);
      return;
    }

    if (message.type === 'failed') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      worker.finalMessage = true;
      runtime.graph.fail(worker.taskId, message.error);
    }
  }

  private async runWorkerToolCall(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    task: TaskRecord,
    message: Extract<WorkerMessage, { type: 'tool-call' }>,
    controller: AbortController,
  ): Promise<void> {
    try {
      if (!this.options.tools) throw new Error('Tool broker is unavailable');
      const call = await this.options.tools.call(
        {
          projectId: runtime.projectId,
          taskId: task.taskId,
          agentId: task.assignee?.agentId,
          toolId: message.toolId,
          input: message.input,
          accessCeiling: message.accessCeiling,
        },
        { accessCeiling: task.assignee?.accessCeiling, signal: controller.signal },
      );
      if (call.status !== 'completed') {
        const error = new Error(
          call.error?.message ?? `Tool call ended with status ${call.status}`,
        );
        if (call.error?.code) Object.assign(error, { code: call.error.code });
        throw error;
      }
      this.send(worker.child, {
        type: 'tool-result',
        requestId: message.requestId,
        output: call.output,
      });
    } catch (error) {
      this.send(worker.child, {
        type: 'tool-result',
        requestId: message.requestId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof Error &&
          'code' in error &&
          (typeof error.code === 'string' || typeof error.code === 'number')
            ? { code: String(error.code) }
            : {}),
          retryable: false,
        },
      });
    } finally {
      worker.toolCalls.delete(message.requestId);
    }
  }

  private async onWorkerError(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    error: Error,
  ): Promise<void> {
    if (worker.stopRequested || worker.finalMessage) return;
    worker.finalMessage = true;
    this.handleUnexpectedExit(runtime, worker, error.message);
  }

  private async onWorkerExit(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): Promise<void> {
    if (worker.cancelTimer) clearTimeout(worker.cancelTimer);
    if (this.workers.get(worker.taskId) === worker) this.workers.delete(worker.taskId);
    for (const controller of worker.toolCalls.values()) controller.abort('worker_exit');
    worker.toolCalls.clear();
    for (const resolveAcknowledgement of worker.answerAcks.values()) {
      resolveAcknowledgement(false);
    }
    worker.answerAcks.clear();
    worker.resolveExit();
    if (!worker.stopRequested && !worker.finalMessage) {
      this.handleUnexpectedExit(
        runtime,
        worker,
        `Worker exited without a result (code=${String(code)}, signal=${String(signal)})`,
      );
    }
    if (!this.disposed) await this.schedule();
  }

  private handleUnexpectedExit(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    message: string,
  ): void {
    const task = runtime.store.get(worker.taskId);
    if (!task || (task.state !== 'running' && task.state !== 'claimed')) return;
    if (task.state === 'claimed') {
      runtime.graph.transition(task.taskId, 'ready', 'worker_exit', 'scheduler', { lease: null });
      runtime.graph.appendEvent(
        task.taskId,
        TaskEventKind.Retry,
        { attempt: task.attempt, reason: message },
        'scheduler',
      );
      return;
    }
    runtime.graph.fail(task.taskId, {
      message,
      code: 'worker_exit',
      retryable: true,
    });
  }

  private async expireLeases(): Promise<Set<string>> {
    const now = this.now().getTime();
    const expired = new Set<string>();
    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      const tasks = runtime.store.list({ states: ['claimed', 'running'], limit: 1_000 });
      for (const task of tasks) {
        if (!task.lease || Date.parse(task.lease.expiresAt) > now) continue;
        expired.add(task.taskId);
        this.retryAfter.set(task.taskId, now + this.tickIntervalMs);
        const worker = this.workers.get(task.taskId);
        if (worker) {
          worker.stopRequested = true;
          for (const controller of worker.toolCalls.values()) controller.abort('lease_expired');
          this.send(worker.child, { type: 'cancel' });
          worker.cancelTimer = setTimeout(() => worker.child.kill('SIGKILL'), 2_000);
          worker.cancelTimer.unref();
        }
        runtime.graph.transition(task.taskId, 'ready', 'lease_expired', 'scheduler', {
          lease: null,
        });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: 'lease_expired' },
          'scheduler',
        );
      }
    }
    return expired;
  }

  private async enforceDurationBudgets(): Promise<void> {
    const now = this.now().getTime();
    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      const tasks = runtime.store.list({
        states: ['claimed', 'running', 'waiting_input'],
        limit: 1_000,
      });
      for (const task of tasks) {
        const maxDuration = task.budget.maxDurationMs;
        if (maxDuration === undefined || !task.startedAt) continue;
        if (now - Date.parse(task.startedAt) >= maxDuration) {
          await runtime.graph.cancel(task.taskId, 'budget_exceeded');
        }
      }
    }
  }

  private async shutdown(checkpoint: boolean): Promise<void> {
    for (const worker of this.workers.values()) {
      worker.stopRequested = true;
      for (const controller of worker.toolCalls.values()) controller.abort('service_stop');
      this.send(worker.child, { type: checkpoint ? 'checkpoint-and-stop' : 'cancel' });
    }
    const workers = [...this.workers.values()];
    await Promise.race([Promise.all(workers.map((worker) => worker.exitPromise)), delay(10_000)]);
    for (const worker of this.workers.values()) {
      if (worker.child.exitCode === null && worker.child.signalCode === null) {
        worker.child.kill('SIGKILL');
      }
    }
    await Promise.all(workers.map((worker) => worker.exitPromise));

    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      for (const task of runtime.store.list({ states: ['claimed', 'running'], limit: 1_000 })) {
        runtime.graph.transition(task.taskId, 'ready', 'service_stop', 'service', { lease: null });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: 'service_stop' },
          'service',
        );
      }
    }
  }

  private send(child: ChildProcess, message: WorkerCommand): void {
    if (!child.connected) return;
    child.send(message, () => undefined);
  }
}

function resolveWorkerMain(): string {
  const local = path.join(__dirname, 'worker-main.js');
  return existsSync(local)
    ? local
    : path.resolve(__dirname, '..', '..', 'lib', 'workers', 'worker-main.js');
}
