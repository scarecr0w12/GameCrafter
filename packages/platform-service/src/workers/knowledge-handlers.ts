import type { TaskResult } from '@gamecrafter/contracts';
import type { TaskHandlerContext } from './types';

export async function knowledgeReindex(context: TaskHandlerContext): Promise<TaskResult> {
  return runKnowledgeTask(context, 'knowledge.reindex');
}

export async function knowledgeReconcile(context: TaskHandlerContext): Promise<TaskResult> {
  return runKnowledgeTask(context, 'knowledge.reconcile');
}

async function runKnowledgeTask(
  context: TaskHandlerContext,
  kind: 'knowledge.reindex' | 'knowledge.reconcile',
): Promise<TaskResult> {
  context.progress('Reconciling Project knowledge index', 0);
  const input = asRecord(context.input);
  const result = asRecord(
    await context.tool('knowledge/index-execute', {
      kind,
      full: kind === 'knowledge.reconcile' || input.full === true,
    }),
  );
  context.progress('Project knowledge index reconciled', 100);
  return {
    summary:
      typeof result.summary === 'string' ? result.summary : 'Project knowledge index reconciled.',
    artifacts: [],
    evidence: [{ kind: 'knowledge-index', ref: context.task.taskId }],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
