import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import type { SettingsService } from '../settings/settings-service';
import { resolveProjectPath } from '../assets/path-utils';

const execFileAsync = promisify(execFile);

export interface TaskWorktree {
  path: string;
  branch: string;
  baseCommit: string;
}

export type GitCommand = (args: string[], cwd: string) => Promise<string>;

export class WorktreeManager {
  constructor(
    private readonly projects: ProfileStore,
    private readonly settings: SettingsService,
    private readonly git: GitCommand = defaultGitCommand,
  ) {}

  async create(projectId: string, taskId: string): Promise<TaskWorktree> {
    const project = this.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const directory = String(
      this.settings.resolve('coordination.worktreeDirectory', { projectId }).value ??
        '.gamecrafter/worktrees',
    );
    const worktreePath = resolveProjectPath(project.path, path.join(directory, taskId));
    const branch = `task/${taskId.slice(-8)}`;
    if (existsSync(worktreePath)) {
      throw new RpcError(
        `Worktree path already exists: ${worktreePath}`,
        RpcErrorCode.WorktreeUnavailable,
      );
    }
    mkdirSync(path.dirname(worktreePath), { recursive: true });
    let baseCommit: string;
    try {
      baseCommit = (await this.git(['rev-parse', 'HEAD'], project.path)).trim();
      await this.git(['worktree', 'add', worktreePath, '-b', branch, baseCommit], project.path);
    } catch (error) {
      throw new RpcError(
        `Unable to create a task worktree: ${error instanceof Error ? error.message : String(error)}`,
        RpcErrorCode.WorktreeUnavailable,
      );
    }
    return { path: worktreePath, branch, baseCommit };
  }

  async remove(projectId: string, worktreePath: string, branch?: string): Promise<void> {
    const project = this.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const relativePath = path.isAbsolute(worktreePath)
      ? path.relative(project.path, worktreePath)
      : worktreePath;
    const safePath = resolveProjectPath(project.path, relativePath);
    try {
      await this.git(['worktree', 'remove', '--force', safePath], project.path);
      if (branch) await this.git(['branch', '-D', branch], project.path);
    } catch (error) {
      throw new RpcError(
        `Unable to remove task worktree: ${error instanceof Error ? error.message : String(error)}`,
        RpcErrorCode.WorktreeUnavailable,
      );
    }
  }
}

const defaultGitCommand: GitCommand = async (args, cwd) => {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
};
