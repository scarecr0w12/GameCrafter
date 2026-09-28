import { afterEach, describe, expect, it } from 'vitest';
import { RpcErrorCode, uuidv7, type TaskRecord } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { TaskStore } from './task-store';

let database: Database;
let store: TaskStore;

afterEach(() => database?.close());

describe('TaskStore', () => {
  it('persists task transitions and ordered project events transactionally', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    store = new TaskStore(database);
    const task = createTask();

    store.insert(task);
    const ready = store.transition(task.taskId, 'ready', 'no_dependencies', 'scheduler');

    expect(ready.state).toBe('ready');
    expect(store.get(task.taskId)).toMatchObject({ state: 'ready', goalHash: task.goalHash });
    expect(store.events({ taskId: task.taskId }).map(({ kind, seq }) => ({ kind, seq }))).toEqual([
      { kind: 'task.created', seq: 1 },
      { kind: 'task.state_changed', seq: 2 },
    ]);
    let transitionError: unknown;
    try {
      store.transition(task.taskId, 'succeeded', 'invalid', 'test');
    } catch (error) {
      transitionError = error;
    }
    expect(transitionError).toMatchObject({ code: RpcErrorCode.InvalidTaskTransition });
  });

  it('filters task lists and trees by state and hierarchy', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    store = new TaskStore(database);
    const root = createTask();
    const child = createTask({
      taskId: uuidv7(),
      parentTaskId: root.taskId,
      rootTaskId: root.taskId,
      depth: 1,
    });
    store.insert(root);
    store.insert(child);
    store.transition(root.taskId, 'ready', 'test', 'test');

    expect(store.list({ states: ['pending'] }).map(({ taskId }) => taskId)).toEqual([child.taskId]);
    expect(store.list({ parentTaskId: null }).map(({ taskId }) => taskId)).toEqual([root.taskId]);
    expect(store.tree(root.taskId).map(({ taskId }) => taskId)).toEqual([
      root.taskId,
      child.taskId,
    ]);
  });
});

function createTask(patch: Partial<TaskRecord> = {}): TaskRecord {
  const now = '2026-09-28T00:00:00.000Z';
  const taskId = uuidv7();
  return {
    schemaVersion: 1,
    taskId,
    projectId: '019535d4-2c00-7000-8000-000000000102',
    parentTaskId: null,
    rootTaskId: taskId,
    depth: 0,
    kind: 'noop.echo',
    title: 'Echo input',
    goal: 'Echo input',
    goalHash: 'e'.repeat(64),
    state: 'pending',
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
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    ...patch,
  };
}
