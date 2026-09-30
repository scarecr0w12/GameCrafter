import { describe, expect, it } from 'vitest';
import { uuidv7, type TaskEvent, type TaskQuestion, type TaskRecord } from '@gamecrafter/contracts';
import { buildTaskTree, parseImpactSeeds } from './swarm-view-model';

describe('Swarm view model', () => {
  it('parses canon IDs and Project-relative file paths from free text', () => {
    expect(
      parseImpactSeeds(
        'Revise char.aria-vale and quest.harbor-rescue using docs/canon/characters/aria.md; inspect game/README.md.',
      ),
    ).toEqual([
      'canon:char.aria-vale',
      'canon:quest.harbor-rescue',
      'file:docs/canon/characters/aria.md',
      'file:game/README.md',
    ]);
  });

  it('builds a task tree with roles, latest progress, and pending questions', () => {
    const root = taskRecord({ title: 'Change request' });
    const child = taskRecord({
      parentTaskId: root.taskId,
      rootTaskId: root.taskId,
      depth: 1,
      title: 'Implement the change',
      role: 'gameplay-engineer',
    });
    const complete = taskRecord({
      parentTaskId: root.taskId,
      rootTaskId: root.taskId,
      depth: 1,
      title: 'Validate the change',
      createdAt: '2026-09-29T00:00:00.001Z',
      assignee: { role: 'validator', accessCeiling: 'restricted' },
      state: 'succeeded',
    });
    const event: TaskEvent = {
      eventId: uuidv7(),
      seq: 4,
      taskId: child.taskId,
      kind: 'task.progress',
      occurredAt: '2026-09-29T00:00:00.000Z',
      actor: 'worker',
      payload: { message: 'Writing tests', percent: 45 },
    };
    const question: TaskQuestion = {
      questionId: uuidv7(),
      taskId: child.taskId,
      prompt: 'Which control should trigger the action?',
      options: ['Keyboard', 'Mouse'],
      askedAt: '2026-09-29T00:00:00.000Z',
      answer: null,
      answeredAt: null,
    };

    const tree = buildTaskTree([root, child, complete], root.taskId, [event], [question]);

    expect(tree).toMatchObject({
      task: { taskId: root.taskId },
      children: [
        {
          task: { taskId: child.taskId },
          role: 'gameplay-engineer',
          progress: 45,
          pendingQuestions: [{ questionId: question.questionId }],
        },
        {
          task: { taskId: complete.taskId },
          role: 'validator',
          progress: 100,
          pendingQuestions: [],
        },
      ],
    });
  });
});

function taskRecord(patch: Partial<TaskRecord> = {}): TaskRecord {
  const taskId = uuidv7();
  const now = '2026-09-29T00:00:00.000Z';
  return {
    schemaVersion: 1,
    taskId,
    projectId: uuidv7(),
    parentTaskId: null,
    rootTaskId: taskId,
    depth: 0,
    kind: 'agent.run',
    title: 'Agent task',
    goal: 'Complete task',
    goalHash: 'f'.repeat(64),
    state: 'running',
    priority: 50,
    dependsOn: [],
    assignee: null,
    budget: {},
    spent: { costUsd: 0, tokens: 0 },
    attempt: 1,
    maxAttempts: 3,
    lease: null,
    input: null,
    checkpoint: null,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    finishedAt: null,
    ...patch,
  };
}
