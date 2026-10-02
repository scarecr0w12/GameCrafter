import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectManifest, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { projectMigrations } from '../projects/migrations';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { summaryFromManifest } from '../projects/workspace';
import { WorktreeManager } from './worktree-manager';

let root: string | undefined;
let database: Database | undefined;
let projectDatabases: ProjectDatabases | undefined;

afterEach(() => {
  projectDatabases?.close();
  database?.close();
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
  database = undefined;
  projectDatabases = undefined;
});

describe('WorktreeManager', () => {
  it('creates an ignored Project-local worktree and removes its branch cleanly', async () => {
    root = mkdtempSync(path.join(tmpdir(), 'gc-worktree-manager-'));
    const projectPath = path.join(root, 'project');
    mkdirSync(path.join(projectPath, '.gamecrafter'), { recursive: true });
    writeFileSync(path.join(projectPath, '.gitignore'), '.gamecrafter/worktrees/\n');
    writeFileSync(path.join(projectPath, 'README.md'), 'base\n');
    const manifest = projectManifest.assert({
      schemaVersion: 1,
      projectId: uuidv7(),
      name: 'Worktree Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: new Date().toISOString(),
      createdByPlatformVersion: '0.1.0',
    });
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
    execFileSync('git', ['init', '-b', 'main'], { cwd: projectPath, stdio: 'ignore' });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], {
      cwd: projectPath,
      stdio: 'ignore',
    });
    execFileSync('git', ['add', '-A'], { cwd: projectPath, stdio: 'ignore' });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=GameCrafter',
        '-c',
        'user.email=gamecrafter@localhost',
        'commit',
        '-m',
        'base',
      ],
      { cwd: projectPath, stdio: 'ignore' },
    );

    database = Database.open(':memory:');
    migrate(database, profileMigrations);
    const profile = new ProfileStore(database);
    profile.register(summaryFromManifest(manifest, projectPath, null));
    const projectDatabase = Database.open(path.join(projectPath, '.gamecrafter', 'project.sqlite'));
    migrate(projectDatabase, projectMigrations);
    projectDatabase.close();
    projectDatabases = new ProjectDatabases(profile);
    const settingsRegistry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
    const settings = new SettingsService(settingsRegistry, database, projectDatabases);
    const manager = new WorktreeManager(profile, settings);

    const taskId = uuidv7();
    const worktree = await manager.create(manifest.projectId, taskId);

    expect(worktree.path).toBe(path.join(projectPath, '.gamecrafter', 'worktrees', taskId));
    expect(readFileSync(path.join(worktree.path, 'README.md'), 'utf8')).toBe('base\n');
    expect(
      execFileSync('git', ['check-ignore', '-v', path.relative(projectPath, worktree.path)], {
        cwd: projectPath,
        encoding: 'utf8',
      }),
    ).toContain('.gamecrafter/worktrees/');
    expect(
      execFileSync('git', ['branch', '--list', worktree.branch], {
        cwd: projectPath,
        encoding: 'utf8',
      }),
    ).toContain(worktree.branch);

    await manager.remove(manifest.projectId, worktree.path, worktree.branch);

    expect(existsSync(worktree.path)).toBe(false);
    expect(
      execFileSync('git', ['branch', '--list', worktree.branch], {
        cwd: projectPath,
        encoding: 'utf8',
      }).trim(),
    ).toBe('');
  });
});
