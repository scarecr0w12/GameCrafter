import type { TaskHandlerContext } from './types';
import { runAgentTask } from '../agents/agent-runtime';

export function agentRun(context: TaskHandlerContext) {
  return runAgentTask(context);
}
