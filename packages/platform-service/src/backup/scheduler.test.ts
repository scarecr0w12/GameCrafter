import { describe, expect, it } from 'vitest';
import type { BackupPlan } from '@gamecrafter/contracts';
import { BackupScheduler, nextBackupTime } from './scheduler';

const plan: BackupPlan = {
  schemaVersion: 1,
  planId: '019535d4-2c00-7000-8000-000000000001',
  scope: 'profile',
  projectId: null,
  destinationId: '019535d4-2c00-7000-8000-000000000002',
  identityId: '019535d4-2c00-7000-8000-000000000003',
  schedule: { kind: 'interval', everyMinutes: 15 },
  retention: { keepLast: 2, keepDays: null },
  enabled: true,
  lastRunAt: null,
  nextRunAt: '2026-09-29T11:00:00.000Z',
  createdAt: '2026-09-29T10:00:00.000Z',
  updatedAt: '2026-09-29T10:00:00.000Z',
};

describe('BackupScheduler', () => {
  it('computes interval and local daily schedules', () => {
    expect(
      nextBackupTime(
        { kind: 'interval', everyMinutes: 30 },
        '2026-09-29T10:00:00.000Z',
        new Date(),
      ),
    ).toBe('2026-09-29T10:30:00.000Z');
    const now = new Date(2026, 8, 29, 1, 0, 0);
    const daily = nextBackupTime({ kind: 'daily', at: '02:15' }, null, now);
    expect(new Date(daily!).getHours()).toBe(2);
    expect(new Date(daily!).getMinutes()).toBe(15);
    expect(nextBackupTime({ kind: 'manual' }, null, now)).toBeNull();
  });

  it('runs a missed scheduled plan once at startup and skips it while active', async () => {
    let now = new Date('2026-09-29T12:00:00.000Z');
    let timer: { callback: () => void; delay: number; unref(): void } | undefined;
    let active = false;
    const calls: string[] = [];
    const scheduler = new BackupScheduler({
      plans: () => [plan],
      savePlan: () => undefined,
      isPlanActive: () => active,
      runPlan: async (planId) => {
        calls.push(planId);
        active = true;
      },
      now: () => now,
      setTimer: (callback, delay) => {
        timer = { callback, delay, unref: () => undefined };
        return timer as unknown as NodeJS.Timeout;
      },
      clearTimer: () => {
        timer = undefined;
      },
    });
    scheduler.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toEqual([plan.planId]);
    expect(timer?.delay).toBe(60_000);
    timer?.callback();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toHaveLength(1);
    active = false;
    now = new Date('2026-09-29T12:01:00.000Z');
    scheduler.stop();
  });
});
