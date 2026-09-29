import type { BackupPlan, BackupSchedule } from '@gamecrafter/contracts';

export interface BackupSchedulerOptions {
  plans(): BackupPlan[];
  savePlan(plan: BackupPlan): void;
  isPlanActive(planId: string): boolean;
  runPlan(planId: string): Promise<unknown>;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  clearTimer?: (timer: NodeJS.Timeout) => void;
}

export function nextBackupTime(
  schedule: BackupSchedule,
  baseTime: string | null,
  now: Date,
): string | null {
  if (schedule.kind === 'manual') return null;
  if (schedule.kind === 'interval') {
    const base = baseTime ? new Date(baseTime) : now;
    return new Date(base.getTime() + schedule.everyMinutes * 60_000).toISOString();
  }
  const [hour, minute] = schedule.at.split(':').map(Number);
  const candidate = baseTime ? new Date(baseTime) : new Date(now);
  candidate.setHours(hour!, minute!, 0, 0);
  if (baseTime) {
    if (candidate.getTime() <= new Date(baseTime).getTime())
      candidate.setDate(candidate.getDate() + 1);
  } else if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString();
}

export class BackupScheduler {
  private timer?: NodeJS.Timeout;
  private stopped = true;
  private ticking?: Promise<void>;
  private readonly now: () => Date;
  private readonly setTimer: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  private readonly clearTimer: (timer: NodeJS.Timeout) => void;

  constructor(private readonly options: BackupSchedulerOptions) {
    this.now = options.now ?? (() => new Date());
    this.setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) this.clearTimer(this.timer);
    this.timer = undefined;
  }

  wake(): void {
    if (this.stopped) return;
    if (this.timer) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => {
      this.timer = undefined;
      void this.tick();
    }, 0);
    this.timer.unref?.();
  }

  private tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.ticking) return this.ticking;
    this.ticking = this.processDuePlans().finally(() => {
      this.ticking = undefined;
    });
    return this.ticking;
  }

  private async processDuePlans(): Promise<void> {
    if (this.stopped) return;
    const now = this.now();
    let nextDelay = 60_000;
    for (const original of this.options.plans()) {
      if (!original.enabled || original.schedule.kind === 'manual') continue;
      const nextRunAt =
        original.nextRunAt ??
        nextBackupTime(original.schedule, original.lastRunAt ?? original.createdAt, now);
      let plan = original;
      if (original.nextRunAt !== nextRunAt) {
        plan = { ...original, nextRunAt, updatedAt: now.toISOString() };
        this.options.savePlan(plan);
      }
      if (!nextRunAt) continue;
      const dueAt = Date.parse(nextRunAt);
      if (dueAt <= now.getTime()) {
        if (!this.options.isPlanActive(plan.planId)) {
          void this.options.runPlan(plan.planId).catch(() => undefined);
        }
        continue;
      }
      nextDelay = Math.min(nextDelay, Math.max(1, dueAt - now.getTime()));
    }
    if (this.stopped) return;
    this.timer = this.setTimer(() => {
      this.timer = undefined;
      void this.tick();
    }, nextDelay);
    this.timer.unref?.();
  }
}
