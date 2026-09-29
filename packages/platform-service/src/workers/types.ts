import type { AccessMode, TaskError, TaskRecord, TaskResult } from '@gamecrafter/contracts';

export interface TaskHandlerContext {
  task: TaskRecord;
  input: unknown;
  initialCheckpoint: unknown;
  signal: AbortSignal;
  progress(message: string, percent?: number): void;
  checkpoint(data: unknown): Promise<void>;
  ask(prompt: string, options?: string[]): Promise<unknown>;
  tool(toolId: string, input: unknown): Promise<unknown>;
  reportUsage(usage: { costUsd?: number; tokens?: number }): Promise<void>;
}

export type TaskHandler = (context: TaskHandlerContext) => Promise<TaskResult> | TaskResult;

export interface WorkerRunPayload {
  type: 'run';
  task: TaskRecord;
  handler: { module: string; export?: string };
  input: unknown;
  checkpoint: unknown;
}

export type WorkerCommand =
  | WorkerRunPayload
  | { type: 'answer'; questionId: string; answer: unknown }
  | { type: 'tool-result'; requestId: string; output?: unknown; error?: TaskError }
  | { type: 'checkpoint-ack'; requestId: string }
  | { type: 'result-ack' }
  | { type: 'cancel' }
  | { type: 'checkpoint-and-stop' };

export type WorkerMessage =
  | { type: 'heartbeat' }
  | { type: 'answer-received'; questionId: string }
  | {
      type: 'tool-call';
      requestId: string;
      toolId: string;
      input: unknown;
      accessCeiling?: AccessMode;
    }
  | {
      type: 'progress';
      message: string;
      percent?: number;
      usage?: { costUsd?: number; tokens?: number };
    }
  | { type: 'checkpoint'; requestId: string; checkpoint: unknown }
  | { type: 'question'; questionId: string; prompt: string; options: string[] | null }
  | { type: 'result'; result: TaskResult }
  | { type: 'failed'; error: TaskError }
  | { type: 'stopped' };
