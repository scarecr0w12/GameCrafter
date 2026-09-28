import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectManifest, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { projectMigrations } from '../projects/migrations';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { TaskService } from '../tasks/task-service';
import { HandlerRegistry, registerBuiltinHandlers } from './handler-registry';
import { WorkerSupervisor } from './supervisor';

describe('WorkerSupervisor', () => {
  it('expires a worker lease using the injected clock', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-lease-test-'));
    const projectId = uuidv7();
    const projectPath = path.join(root, 'project');
    const statePath = path.join(projectPath, '.gamecrafter');
    mkdirSync(statePath, { recursive: true });
    const createdAt = new Date().toISOString();
    const manifest = projectManifest.assert({
      schemaVersion: 1,
      projectId,
      name: 'Lease Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt,
      createdByPlatformVersion: '0.1.0',
    });
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));

    const profileDatabase = Database.open(':memory:');
    let projectDatabases: ProjectDatabases | undefined;
    let supervisor: WorkerSupervisor | undefined;
    try {
      migrate(profileDatabase, profileMigrations);
      const profile = new ProfileStore(profileDatabase);
      profile.register(summaryFromManifest(manifest, projectPath, null));
      const localProjectDatabase = Database.open(path.join(statePath, 'project.sqlite'));
      migrate(localProjectDatabase, projectMigrations);
      localProjectDatabase.close();
      projectDatabases = new ProjectDatabases(profile);

      const registry = new SettingsRegistry();
      const builtins = createBuiltinSettings();
      registry.register('builtin', builtins.groups, builtins.definitions);
      const settings = new SettingsService(registry, profileDatabase, projectDatabases);
      const handlers = new HandlerRegistry();
      registerBuiltinHandlers(
        handlers,
        path.join(__dirname, '..', '..', 'lib', 'workers', 'builtin-handlers.js'),
      );
      const taskService = new TaskService(profile, projectDatabases, settings, handlers, {
        taskChanged: () => undefined,
        taskEvent: () => undefined,
        taskQuestion: () => undefined,
      });
      const task = taskService.create({
        projectId,
        kind: 'noop.sleep',
        title: 'Lease expiry',
        goal: 'Exercise lease recovery',
        input: { ms: 10_000 },
      }).task;
      let time = Date.now();
      supervisor = new WorkerSupervisor({
        tasks: taskService,
        settings,
        handlers,
        now: () => new Date(time),
        leaseTtlMs: 100,
        tickIntervalMs: 60_000,
      });
      taskService.setSupervisor(supervisor);

      await supervisor.schedule();
      await waitForRunning(taskService, projectId, task.taskId);
      time += 200;
      await supervisor.schedule();

      const expired = taskService.get(projectId, task.taskId);
      expect(expired.state).toBe('ready');
      expect(expired.attempt).toBe(1);
      expect(
        taskService
          .eventsForProject(projectId, { taskId: task.taskId })
          .some(
            (event) =>
              event.kind === 'task.retry' &&
              (event.payload as { reason?: string }).reason === 'lease_expired',
          ),
      ).toBe(true);
    } finally {
      await supervisor?.stopAll({ checkpoint: false });
      projectDatabases?.close();
      profileDatabase.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});

async function waitForRunning(
  service: TaskService,
  projectId: string,
  taskId: string,
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (service.get(projectId, taskId).state === 'running') return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Task did not start: ${taskId}`);
}
