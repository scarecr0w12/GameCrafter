import { describe, expect, it } from 'vitest';
import { compile } from '../validation';
import {
  computeGoalHash,
  isTerminal,
  TASK_TRANSITIONS,
  TaskRecordSchema,
  type TaskRecord,
  type TaskState,
} from './index';

const sampleTask = (state: TaskState = 'pending'): TaskRecord => ({
  schemaVersion: 1,
  taskId: '019535d4-2c00-7000-8000-000000000101',
  projectId: '019535d4-2c00-7000-8000-000000000102',
  parentTaskId: null,
  rootTaskId: '019535d4-2c00-7000-8000-000000000101',
  depth: 0,
  kind: 'noop.echo',
  title: 'Echo input',
  goal: 'Echo the input.',
  goalHash: 'e'.repeat(64),
  state,
  priority: 50,
  dependsOn: [],
  assignee: null,
  budget: {},
  spent: { costUsd: 0, tokens: 0 },
  attempt: 1,
  maxAttempts: 3,
  lease: null,
  input: { message: 'hello' },
  checkpoint: null,
  result: null,
  error: null,
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
});

describe('task contracts', () => {
  it('defines the task state transition graph', () => {
    expect(TASK_TRANSITIONS.pending).toEqual(['ready', 'blocked', 'cancelled']);
    expect(TASK_TRANSITIONS.failed).toEqual(['ready']);
    expect(TASK_TRANSITIONS.succeeded).toEqual([]);
    expect(TASK_TRANSITIONS.cancelled).toEqual([]);
  });

  it('identifies terminal states', () => {
    expect(isTerminal('succeeded')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('waiting_input')).toBe(false);
  });

  it('hashes normalized goals with their handler kind', () => {
    expect(computeGoalHash('noop.echo', '  Find  THE\nSecret   Key ')).toBe(
      '61adc240d02f0b20e43066c6db2369684250d647265776a64a0fb658efb95715',
    );
    expect(computeGoalHash('noop.sleep', 'Find the secret key')).not.toBe(
      computeGoalHash('noop.echo', 'Find the secret key'),
    );
  });

  it('compiles and validates a complete versioned Task record', () => {
    const validator = compile<TaskRecord>(TaskRecordSchema);
    expect(validator.check(sampleTask())).toBe(true);
    expect(validator.check({ ...sampleTask(), priority: 101 })).toBe(false);
    expect(validator.check({ ...sampleTask(), schemaVersion: 2 })).toBe(false);
  });
});
