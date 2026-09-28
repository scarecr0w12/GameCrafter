import type { TaskRecord, TaskResult } from '@gamecrafter/contracts';
import type { TaskHandlerContext } from './types';

export async function noopEcho(context: TaskHandlerContext): Promise<TaskResult> {
  return {
    summary: 'echo',
    artifacts: [],
    evidence: [{ kind: 'input', ref: JSON.stringify(context.input) ?? 'null' }],
  };
}

export async function noopSleep(context: TaskHandlerContext): Promise<TaskResult> {
  const input = asRecord(context.input);
  const duration = Math.max(0, Number(input.ms) || 0);
  await sleep(duration / 2, context.signal);
  context.progress('sleep halfway', 50);
  await sleep(duration - duration / 2, context.signal);
  context.progress('sleep complete', 100);
  return { summary: 'sleep complete', artifacts: [], evidence: [] };
}

export async function noopFail(context: TaskHandlerContext): Promise<TaskResult> {
  const input = asRecord(context.input);
  const error = new Error(String(input.message ?? 'Requested task failure')) as Error & {
    retryable?: boolean;
    code?: string;
  };
  error.retryable = input.retryable === true;
  if (typeof input.code === 'string') error.code = input.code;
  throw error;
}

export async function noopAsk(context: TaskHandlerContext): Promise<TaskResult> {
  const input = asRecord(context.input);
  const prompt = String(input.prompt ?? 'Please provide an answer');
  const options = Array.isArray(input.options)
    ? input.options.filter((option): option is string => typeof option === 'string')
    : undefined;
  const answer = await context.ask(prompt, options);
  return {
    summary: typeof answer === 'string' ? answer : (JSON.stringify(answer) ?? String(answer)),
    artifacts: [],
    evidence: [{ kind: 'answer', ref: JSON.stringify(answer) ?? 'null' }],
  };
}

export async function noopCheckpointed(context: TaskHandlerContext): Promise<TaskResult> {
  const input = asRecord(context.input);
  const checkpoint = asRecord(context.initialCheckpoint);
  const steps = Math.max(0, Math.floor(Number(input.steps) || 0));
  const crashAt = Math.max(0, Math.floor(Number(input.crashAt) || 0));
  const crashed = checkpoint.crashObserved === true;
  const completed = Math.max(0, Math.floor(Number(checkpoint.step) || 0));

  for (let step = completed + 1; step <= steps; step += 1) {
    if (context.signal.aborted) throw abortError();
    if (step === crashAt && !crashed) {
      await context.checkpoint({ step: step - 1, crashObserved: true });
      process.exit(1);
    }
    await context.checkpoint({ step });
    context.progress(
      `completed step ${step}`,
      steps === 0 ? 100 : Math.floor((step / steps) * 100),
    );
  }

  return {
    summary: `completed ${steps} steps`,
    artifacts: [],
    evidence: [{ kind: 'checkpoint', ref: JSON.stringify({ step: steps }) }],
  };
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error('Task worker was cancelled');
  error.name = 'AbortError';
  return error;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function taskResult(task: TaskRecord, summary: string): TaskResult {
  return {
    summary,
    artifacts: [],
    evidence: [{ kind: 'task', ref: task.taskId }],
  };
}
