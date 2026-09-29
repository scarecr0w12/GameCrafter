import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectManifest, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { TaskService } from '../tasks/task-service';
import { HandlerRegistry, registerBoardMaintenanceHandlers } from '../workers/handler-registry';
import { BoardService } from './board-service';
import { BoardMaintenanceScheduler } from './maintenance-scheduler';

const fixtures: Array<() => void> = [];
afterEach(() => {
  for (const close of fixtures.splice(0)) close();
});

describe('BoardMaintenanceScheduler', () => {
  it('schedules one due audit, then skips future work while maintenance is disabled', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-scheduler-'));
    const projectPath = path.join(root, 'project');
    mkdirSync(projectPath, { recursive: true });
    const profileDatabase = Database.open(':memory:');
    migrate(profileDatabase, profileMigrations);
    const profile = new ProfileStore(profileDatabase);
    const manifest = projectManifest.assert({
      schemaVersion: 1,
      projectId: uuidv7(),
      name: 'Scheduler Project',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: '2026-09-28T12:00:00.000Z',
      createdByPlatformVersion: '0.1.0',
    });
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
    profile.register(summaryFromManifest(manifest, projectPath, null, true));
    const projectDatabases = new ProjectDatabases(profile);
    projectDatabases.get(manifest.projectId);
    const settingsRegistry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
    const settings = new SettingsService(settingsRegistry, profileDatabase, projectDatabases);
    settings.set('board.auditIntervalMinutes', 'project', 1, { projectId: manifest.projectId });
    const handlers = new HandlerRegistry();
    registerBoardMaintenanceHandlers(
      handlers,
      path.resolve(__dirname, '../workers/board-maintenance-handlers.ts'),
    );
    const tasks = new TaskService(profile, projectDatabases, settings, handlers, {
      taskChanged: vi.fn(),
      taskEvent: vi.fn(),
      taskQuestion: vi.fn(),
    });
    const board = new BoardService({
      projectDatabases,
      settings,
      events: {
        threadChanged: vi.fn(),
        messagePosted: vi.fn(),
        decisionChanged: vi.fn(),
      },
    });
    let now = new Date('2026-09-29T00:00:00.000Z');
    const scheduler = new BoardMaintenanceScheduler({
      board,
      tasks,
      settings,
      now: () => now,
      tickIntervalMs: 10,
    });
    fixtures.push(() => {
      scheduler.stop();
      projectDatabases.close();
      profileDatabase.close();
      rmSync(root, { recursive: true, force: true });
    });

    scheduler.start();
    now = new Date('2026-09-29T00:01:01.000Z');
    await waitUntil(async () =>
      (await tasks.list(manifest.projectId)).some(
        (task) => task.kind === 'board-maintenance.audit',
      ),
    );
    expect(
      (await tasks.list(manifest.projectId)).filter((task) =>
        task.kind.startsWith('board-maintenance.'),
      ),
    ).toHaveLength(1);
    await settings.set('board.maintenanceEnabled', 'project', false, {
      projectId: manifest.projectId,
    });
    now = new Date('2026-09-30T00:00:00.000Z');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      (await tasks.list(manifest.projectId)).filter((task) =>
        task.kind.startsWith('board-maintenance.'),
      ),
    ).toHaveLength(1);
  });
});

async function waitUntil(predicate: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Scheduled board audit was not created');
}
