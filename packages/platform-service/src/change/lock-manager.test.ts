import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectManifest, RpcErrorCode, uuidv7, type ToolDefinition } from '@gamecrafter/contracts';
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
import { HandlerRegistry, registerBuiltinHandlers } from '../workers/handler-registry';
import { TaskService } from '../tasks/task-service';
import { ToolBroker } from '../tools/tool-broker';
import { ToolRegistry } from '../tools/tool-registry';
import { LockManager } from './lock-manager';

let root: string | undefined;
let profileDatabase: Database | undefined;
let projectDatabases: ProjectDatabases | undefined;
let projectId: string;

afterEach(() => {
  projectDatabases?.close();
  profileDatabase?.close();
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('LockManager', () => {
  it('acquires sorted resources atomically and enforces the shared/exclusive matrix', () => {
    const env = createLockEnvironment();
    const firstTask = uuidv7();
    const secondTask = uuidv7();
    const conflictingTask = uuidv7();

    const first = env.manager.acquire(
      projectId,
      firstTask,
      'worker-a',
      ['file:z', 'file:a'],
      'shared',
    );
    expect(first.map((lock) => lock.resource)).toEqual(['file:a', 'file:z']);
    const shared = env.manager.acquire(projectId, secondTask, 'worker-b', ['file:a'], 'shared');
    expect(shared).toHaveLength(1);
    expect(() =>
      env.manager.acquire(
        projectId,
        conflictingTask,
        'worker-c',
        ['file:b', 'file:a'],
        'exclusive',
      ),
    ).toThrow(expect.objectContaining({ code: RpcErrorCode.LockConflict }));
    expect(env.manager.list(projectId).some((lock) => lock.taskId === conflictingTask)).toBe(false);

    expect(env.manager.releaseTask(projectId, firstTask)).toHaveLength(2);
    expect(env.manager.assertHeld(projectId, secondTask, 'file:a', 'shared').mode).toBe('shared');
    expect(() => env.manager.assertHeld(projectId, secondTask, 'file:a', 'exclusive')).toThrow(
      expect.objectContaining({ code: RpcErrorCode.LockNotHeld }),
    );
  });

  it('blocks a second task on an engine session until its holder releases the lock', () => {
    const env = createLockEnvironment();
    const firstTaskId = uuidv7();
    const secondTaskId = uuidv7();

    env.manager.acquire(
      projectId,
      firstTaskId,
      'worker-a',
      ['engine-session:editor-1'],
      'exclusive',
    );
    expect(() =>
      env.manager.acquire(
        projectId,
        secondTaskId,
        'worker-b',
        ['engine-session:editor-1'],
        'exclusive',
      ),
    ).toThrow(expect.objectContaining({ code: RpcErrorCode.LockConflict }));
    expect(env.manager.releaseTask(projectId, firstTaskId)).toHaveLength(1);
    expect(
      env.manager.acquire(
        projectId,
        secondTaskId,
        'worker-b',
        ['engine-session:editor-1'],
        'exclusive',
      ),
    ).toHaveLength(1);
  });

  it('enforces broker-required engine-session and declared-file locks', async () => {
    const env = createLockEnvironment();
    env.settings.set('access.mode', 'project', 'full', { projectId });
    const handlers = new HandlerRegistry();
    registerBuiltinHandlers(handlers);
    const tasks = new TaskService(env.profile, env.databases, env.settings, handlers, {
      taskChanged: () => undefined,
      taskEvent: () => undefined,
      taskQuestion: () => undefined,
    });
    const first = tasks.create({
      projectId,
      kind: 'noop.echo',
      title: 'First writer',
      goal: 'Write the shared README',
      touches: [{ resource: 'file:game/README.md', intent: 'write' }],
    }).task;
    const second = tasks.create({
      projectId,
      kind: 'noop.echo',
      title: 'Second writer',
      goal: 'Also write the shared README',
      touches: [{ resource: 'file:game/README.md', intent: 'write' }],
    }).task;
    const registry = new ToolRegistry();
    registry.register(
      toolDefinition('engine/edit-scene', 'live-editor', {
        type: 'object',
        properties: { connectionId: { type: 'string' } },
        required: ['connectionId'],
      }),
      () => ({ output: { status: 'succeeded' } }),
    );
    registry.register(
      toolDefinition('fs/write-file', 'project-file', {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      }),
      () => ({ output: { written: true } }),
    );
    const broker = new ToolBroker({
      registry,
      settings: env.settings,
      projectDatabases: env.databases,
      projects: env.profile,
      tasks,
      locks: env.manager,
      requiredLocks: (request, definition, task) => {
        if (!task) return [];
        if (definition.executionMode === 'live-editor') {
          const connectionId = String((request.input as { connectionId?: string }).connectionId);
          return [{ resource: `engine-session:${connectionId}`, mode: 'exclusive' }];
        }
        if (request.toolId === 'fs/write-file') {
          const resource = 'file:game/README.md';
          const overlap = tasks
            .list(projectId, { states: ['ready', 'running'] })
            .some(
              (candidate) =>
                candidate.taskId !== task.taskId &&
                candidate.touches?.some(
                  (touch) => touch.intent === 'write' && touch.resource === resource,
                ),
            );
          return overlap ? [{ resource, mode: 'exclusive' }] : [];
        }
        return [];
      },
      events: {
        approvalRequested: () => undefined,
        approvalResolved: () => undefined,
        toolCalled: () => undefined,
      },
    });

    await expect(
      broker.call({
        projectId,
        taskId: first.taskId,
        toolId: 'engine/edit-scene',
        input: { connectionId: 'fake-editor' },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.LockNotHeld });
    env.manager.acquire(
      projectId,
      first.taskId,
      'worker-one',
      ['engine-session:fake-editor'],
      'exclusive',
    );
    expect(
      (
        await broker.call({
          projectId,
          taskId: first.taskId,
          toolId: 'engine/edit-scene',
          input: { connectionId: 'fake-editor' },
        })
      ).status,
    ).toBe('completed');

    await expect(
      broker.call({
        projectId,
        taskId: second.taskId,
        toolId: 'fs/write-file',
        input: { path: 'game/README.md', content: 'new' },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.LockNotHeld });
    env.manager.acquire(
      projectId,
      second.taskId,
      'worker-two',
      ['file:game/README.md'],
      'exclusive',
    );
    expect(
      (
        await broker.call({
          projectId,
          taskId: second.taskId,
          toolId: 'fs/write-file',
          input: { path: 'game/README.md', content: 'new' },
        })
      ).status,
    ).toBe('completed');
  });

  it('expires unrenewed locks using the injected clock', () => {
    let time = Date.parse('2026-09-29T00:00:00.000Z');
    const env = createLockEnvironment(() => new Date(time));
    env.settings.set('coordination.lockTimeoutSeconds', 'project', 1, { projectId });
    const lock = env.manager.acquire(
      projectId,
      uuidv7(),
      'worker-a',
      ['engine-session:conn-1'],
      'exclusive',
    )[0]!;
    expect(lock.expiresAt).toBe('2026-09-29T00:00:01.000Z');

    time += 1_001;
    expect(env.manager.list(projectId)).toEqual([]);
    expect(
      env.manager.acquire(projectId, uuidv7(), 'worker-b', ['engine-session:conn-1'], 'exclusive'),
    ).toHaveLength(1);
  });
});

function createLockEnvironment(now: () => Date = () => new Date()) {
  root = mkdtempSync(path.join(tmpdir(), 'gc-lock-manager-'));
  const projectDirectory = path.join(root, 'project');
  const stateDirectory = path.join(projectDirectory, '.gamecrafter');
  mkdirSync(stateDirectory, { recursive: true });
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId: uuidv7(),
    name: 'Lock Test',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt: now().toISOString(),
    createdByPlatformVersion: '0.1.0',
  });
  projectId = manifest.projectId;
  writeFileSync(path.join(projectDirectory, 'gamecrafter.project.json'), JSON.stringify(manifest));
  const database = Database.open(':memory:');
  profileDatabase = database;
  migrate(database, profileMigrations);
  const profile = new ProfileStore(database);
  profile.register(summaryFromManifest(manifest, projectDirectory, null));
  const projectDatabase = Database.open(path.join(stateDirectory, 'project.sqlite'));
  migrate(projectDatabase, projectMigrations);
  projectDatabase.close();
  const databases = new ProjectDatabases(profile);
  projectDatabases = databases;
  const settingsRegistry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
  const settings = new SettingsService(settingsRegistry, database, databases, now);
  const lockManager = new LockManager(databases, settings, now);
  return { manager: lockManager, settings, profile, databases };
}

function toolDefinition(
  toolId: string,
  executionMode: ToolDefinition['executionMode'],
  inputSchema: unknown,
): ToolDefinition {
  return {
    toolId,
    title: toolId,
    description: toolId,
    inputSchema,
    executionMode,
    minAccessMode: 'restricted',
    sideEffects: 'workspace-write',
    evidence: 'Unit test tool.',
    capabilities: [],
    source: 'test',
  };
}
