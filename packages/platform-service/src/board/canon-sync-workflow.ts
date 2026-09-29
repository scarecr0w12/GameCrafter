import { execFile } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  type BindingDecision,
  type CanonSyncProposal,
} from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import type { TaskService } from '../tasks/task-service';
import type { ToolBroker } from '../tools/tool-broker';
import type { BoardService } from './board-service';

const execFileAsync = promisify(execFile);

export interface CanonSyncWorkflowOptions {
  board: BoardService;
  projects: ProfileStore;
  tasks: TaskService;
  tools: ToolBroker;
  now?: () => Date;
}

interface CanonFileChange {
  path: string;
  before: string | null;
  after: string;
}

export class CanonSyncWorkflow {
  private readonly now: () => Date;

  constructor(private readonly options: CanonSyncWorkflowOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async run(decisionId: string, taskId: string, signal?: AbortSignal): Promise<BindingDecision> {
    const initial = this.findDecision(decisionId);
    const project = this.options.projects.getById(initial.projectId);
    if (!project)
      throw new RpcError(`Project not found: ${initial.projectId}`, RpcErrorCode.ProjectNotFound);
    let changes: CanonFileChange[];
    try {
      changes = this.buildChanges(initial, project.path);
    } catch (error) {
      if (error instanceof RpcError && error.code === RpcErrorCode.BoardSyncConflict) {
        this.options.board.updateDecision({
          ...initial,
          syncStatus: 'conflict',
          syncAttempts: initial.syncAttempts + 1,
          lastSyncError: error.message,
        });
      }
      throw error;
    }
    if (initial.syncStatus === 'synchronized') {
      if (
        changes.every((change) => this.readProjectFile(project.path, change.path) === change.after)
      ) {
        return initial;
      }
      const message = 'Synchronized canon record was changed outside the board workflow';
      this.options.board.updateDecision({
        ...initial,
        syncStatus: 'conflict',
        syncAttempts: initial.syncAttempts + 1,
        lastSyncError: message,
      });
      throw new RpcError(message, RpcErrorCode.BoardSyncConflict);
    }

    const synchronizing: BindingDecision = {
      ...initial,
      syncStatus: 'synchronizing',
      syncAttempts: initial.syncAttempts + 1,
      lastSyncError: null,
    };
    this.options.board.updateDecision(synchronizing);
    try {
      const resolvedChanges = this.resolveExistingChanges(project.path, synchronizing, changes);
      const createdAt = this.now().toISOString();
      const proposals: CanonSyncProposal[] = resolvedChanges.map((change) => ({
        proposalId: uuidv7(),
        decisionId,
        projectId: synchronizing.projectId,
        path: change.path,
        before: change.before,
        after: change.after,
        diff: unifiedDiff(change.path, change.before, change.after),
        createdAt,
        appliedAt: null,
        commit: null,
      }));
      for (const proposal of proposals) this.options.board.addProposal(proposal);

      for (const change of resolvedChanges) {
        await this.writeProjectFile(synchronizing, taskId, change, signal);
      }
      validateFileLinks(project.path, resolvedChanges);
      const commit = await this.commitChanges(
        project.path,
        resolvedChanges.map((change) => change.path),
        synchronizing,
      );
      const appliedAt = this.now().toISOString();
      this.options.board.markProposalsApplied(
        synchronizing.projectId,
        decisionId,
        appliedAt,
        commit,
      );
      const synchronized: BindingDecision = {
        ...synchronizing,
        syncStatus: 'synchronized',
        lastSyncError: null,
        syncedAt: appliedAt,
        canonRecordPath: this.decisionPath(synchronizing),
        canonCommit: commit,
      };
      this.options.board.updateDecision(synchronized, 'board.decision.synchronized');
      return synchronized;
    } catch (error) {
      if (error instanceof RpcError && error.code === RpcErrorCode.BoardSyncConflict) {
        const conflict: BindingDecision = {
          ...synchronizing,
          syncStatus: 'conflict',
          lastSyncError: error.message,
        };
        this.options.board.updateDecision(conflict);
        throw error;
      }
      const failed: BindingDecision = {
        ...synchronizing,
        syncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : String(error),
      };
      this.options.board.updateDecision(failed, 'board.decision.sync_failed');
      throw error;
    }
  }

  private findDecision(decisionId: string): BindingDecision {
    for (const project of this.options.projects.list()) {
      try {
        return this.options.board.decision(project.projectId, decisionId);
      } catch (error) {
        if (!(error instanceof RpcError) || error.code !== RpcErrorCode.BoardDecisionNotFound)
          throw error;
      }
    }
    throw new RpcError(
      `Board decision not found: ${decisionId}`,
      RpcErrorCode.BoardDecisionNotFound,
    );
  }

  private buildChanges(decision: BindingDecision, projectPath: string): CanonFileChange[] {
    const decisionPath = this.decisionPath(decision);
    const current = this.readProjectFile(projectPath, decisionPath);
    if (
      current !== null &&
      extractFrontmatterValue(current, 'decisionId') !== decision.decisionId
    ) {
      throw new RpcError(
        `Canon record already exists for another decision: ${decisionPath}`,
        RpcErrorCode.BoardSyncConflict,
      );
    }
    const content = renderDecisionRecord(decision);
    const changes: CanonFileChange[] = [{ path: decisionPath, before: current, after: content }];
    if (decision.supersedes) {
      const previous = this.options.board.decision(decision.projectId, decision.supersedes);
      if (!previous.canonRecordPath) {
        throw new RpcError(
          'Superseded decision has no canon record path',
          RpcErrorCode.BoardSyncConflict,
        );
      }
      const before = this.readProjectFile(projectPath, previous.canonRecordPath);
      if (
        before === null ||
        extractFrontmatterValue(before, 'decisionId') !== previous.decisionId
      ) {
        throw new RpcError(
          `Superseded canon record is missing or belongs to another decision: ${previous.canonRecordPath}`,
          RpcErrorCode.BoardSyncConflict,
        );
      }
      const after = supersedeFrontmatter(before, decision.decisionId);
      changes.push({ path: previous.canonRecordPath, before, after });
    }
    return changes;
  }

  private resolveExistingChanges(
    projectPath: string,
    decision: BindingDecision,
    changes: CanonFileChange[],
  ): CanonFileChange[] {
    return changes.map((change) => {
      const current = this.readProjectFile(projectPath, change.path);
      if (change.path === this.decisionPath(decision) && current !== null) {
        const existingId = extractFrontmatterValue(current, 'decisionId');
        if (existingId !== decision.decisionId) {
          throw new RpcError(
            `Canon record already exists for another decision: ${change.path}`,
            RpcErrorCode.BoardSyncConflict,
          );
        }
      }
      if (current !== change.before && current !== change.after) {
        throw new RpcError(
          `Canon record changed during sync: ${change.path}`,
          RpcErrorCode.BoardSyncConflict,
        );
      }
      return { ...change, before: current };
    });
  }

  private async writeProjectFile(
    decision: BindingDecision,
    taskId: string,
    change: CanonFileChange,
    signal?: AbortSignal,
  ): Promise<void> {
    const task = this.options.tasks.get(decision.projectId, taskId);
    const call = await this.options.tools.call(
      {
        projectId: decision.projectId,
        taskId,
        agentId: task.assignee?.agentId,
        toolId: 'fs/write-file',
        input: { path: change.path, content: change.after, createDirectories: true },
      },
      { signal },
    );
    if (call.status !== 'completed') {
      throw new RpcError(
        call.error?.message ?? `Canonical file write ended with ${call.status}`,
        RpcErrorCode.ToolDenied,
      );
    }
  }

  private readProjectFile(projectPath: string, relativePath: string): string | null {
    const absolutePath = resolveSafeProjectPath(projectPath, relativePath);
    if (!existsSync(absolutePath)) return null;
    return readFileSync(absolutePath, 'utf8');
  }

  private decisionPath(decision: BindingDecision): string {
    const date = decision.boundAt.slice(0, 10);
    const slug =
      decision.title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64) || 'decision';
    return `docs/decisions/${date}-${slug}.md`;
  }

  private async commitChanges(
    projectPath: string,
    relativePaths: string[],
    decision: BindingDecision,
  ): Promise<string> {
    const paths = [...new Set(relativePaths)];
    const changes = await execFileAsync('git', ['status', '--porcelain', '--', ...paths], {
      cwd: projectPath,
      encoding: 'utf8',
    });
    if (!changes.stdout.trim()) {
      const latest = await execFileAsync('git', ['log', '-1', '--format=%H', '--', ...paths], {
        cwd: projectPath,
        encoding: 'utf8',
      });
      if (latest.stdout.trim()) return latest.stdout.trim();
    }
    await execFileAsync('git', ['add', '--', ...paths], { cwd: projectPath, encoding: 'utf8' });
    await execFileAsync(
      'git',
      [
        '-c',
        'user.name=GameCrafter',
        '-c',
        'user.email=gamecrafter@localhost',
        'commit',
        '--only',
        '-m',
        `board: bind decision ${decision.decisionId} — ${decision.title}`,
        '--',
        ...paths,
      ],
      { cwd: projectPath, encoding: 'utf8' },
    );
    const result = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: projectPath,
      encoding: 'utf8',
    });
    return result.stdout.trim();
  }
}

function renderDecisionRecord(decision: BindingDecision): string {
  const rationale = decision.rationale?.trim();
  return [
    '---',
    `decisionId: ${decision.decisionId}`,
    `threadId: ${decision.threadId}`,
    `messageId: ${decision.messageId}`,
    `boundAt: ${decision.boundAt}`,
    'madeBy: user',
    `supersedes: ${decision.supersedes ?? 'null'}`,
    'status: binding',
    '---',
    '',
    `# ${decision.title}`,
    '',
    decision.statement,
    ...(rationale ? ['', '## Rationale', '', rationale] : []),
    '',
    `[Discussion thread](board://${decision.threadId}/${decision.messageId})`,
    '',
  ].join('\n');
}

function supersedeFrontmatter(content: string, supersededBy: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match)
    throw new RpcError(
      'Superseded canon record has invalid frontmatter',
      RpcErrorCode.BoardSyncConflict,
    );
  let frontmatter = match[1]!;
  frontmatter = frontmatter.replace(/^status:\s*.*$/m, 'status: superseded');
  if (/^supersededBy:/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(/^supersededBy:\s*.*$/m, `supersededBy: ${supersededBy}`);
  } else {
    frontmatter += `\nsupersededBy: ${supersededBy}`;
  }
  return content.replace(match[1]!, frontmatter);
}

function extractFrontmatterValue(content: string, key: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return undefined;
  return new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`, 'm').exec(match[1]!)?.[1];
}

function unifiedDiff(relativePath: string, before: string | null, after: string): string {
  const oldLines = before === null ? [] : before.replace(/\n$/, '').split('\n');
  const newLines = after.replace(/\n$/, '').split('\n');
  const output = [
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`),
  ];
  return `${output.join('\n')}\n`;
}

function validateFileLinks(projectPath: string, changes: CanonFileChange[]): void {
  for (const change of changes) {
    const filePath = resolveSafeProjectPath(projectPath, change.path);
    const body = readFileSync(filePath, 'utf8');
    for (const [, target] of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z]+:|#|\/\/)/i.test(target)) continue;
      const resolved = path.resolve(path.dirname(filePath), target.split('#')[0]!);
      if (!isWithinProject(projectPath, resolved) || !existsSync(resolved)) {
        throw new Error(`Canonical link does not resolve: ${target}`);
      }
    }
  }
}

function resolveSafeProjectPath(projectPath: string, relativePath: string): string {
  const root = path.resolve(projectPath);
  const absolute = path.resolve(root, relativePath);
  if (!isWithinProject(root, absolute)) {
    throw new RpcError(
      `Canon path is outside the Project: ${relativePath}`,
      RpcErrorCode.PathOutsideProject,
    );
  }
  let cursor = root;
  for (const segment of path.relative(root, absolute).split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new RpcError(
        `Canon path contains a symbolic link: ${relativePath}`,
        RpcErrorCode.PathOutsideProject,
      );
    }
  }
  return absolute;
}

function isWithinProject(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
