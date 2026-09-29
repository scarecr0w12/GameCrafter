import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectManifest, RpcErrorCode, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { projectMigrations } from '../projects/migrations';
import { BoardService } from './board-service';

const fixtures: Array<() => void> = [];
afterEach(() => {
  for (const close of fixtures.splice(0)) close();
});

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-board-service-'));
  const projectPath = path.join(root, 'project');
  mkdirSync(projectPath, { recursive: true });
  const profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const profile = new ProfileStore(profileDatabase);
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId: uuidv7(),
    name: 'Board Test Project',
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
  const projectDatabase = projectDatabases.get(manifest.projectId);
  migrate(projectDatabase, projectMigrations);
  const settingsRegistry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
  const settings = new SettingsService(settingsRegistry, profileDatabase, projectDatabases);
  const events = {
    threadChanged: vi.fn(),
    messagePosted: vi.fn(),
    decisionChanged: vi.fn(),
  };
  const board = new BoardService({ projectDatabases, settings, events });
  fixtures.push(() => {
    projectDatabases.close();
    profileDatabase.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { board, events, projectId: manifest.projectId, settings };
}

describe('BoardService thread and message behavior', () => {
  it('creates a first message and assigns monotonic per-thread sequence numbers under concurrent posts', async () => {
    const { board, events, projectId } = createFixture();
    const created = board.createThread(
      {
        projectId,
        title: 'Combat room exit route',
        kind: 'discussion',
        tags: ['combat'],
        body: 'The test room needs a readable escape path.',
        type: 'finding',
      },
      { kind: 'user' },
    );
    const posted = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        Promise.resolve(
          board.post(
            {
              projectId,
              threadId: created.thread.threadId,
              type: 'comment',
              body: `Follow-up ${index}`,
            },
            { kind: 'agent', role: 'game-designer', taskId: null },
          ),
        ),
      ),
    );
    const editTarget = posted[0]!;
    const edited = board.edit(projectId, editTarget.messageId, 'Follow-up is resolved.');
    expect(edited.editHistory).toMatchObject([
      { previousBody: editTarget.body, editedAt: expect.any(String) },
    ]);
    const result = board.thread(projectId, created.thread.threadId, {
      includeMessages: true,
      limit: 100,
    });
    expect(created.message.seq).toBe(1);
    expect(posted.map((message) => message.seq).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 2),
    );
    expect(result.messages.map((message) => message.seq)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 1),
    );
    expect(result.thread).toMatchObject({ messageCount: 13, status: 'open', tags: ['combat'] });
    expect(events.messagePosted).toHaveBeenCalledTimes(14);
  });

  it('requires user confirmation to bind and preserves binding-message history', () => {
    const { board, projectId } = createFixture();
    const created = board.createThread(
      {
        projectId,
        title: 'Keep the escape route readable',
        kind: 'proposal',
        body: 'Every combat room must show an escape route.',
        type: 'proposal',
      },
      { kind: 'agent', role: 'planner', taskId: uuidv7() },
    );
    expect(() => board.bind({ projectId, messageId: created.message.messageId })).toThrow(
      expect.objectContaining({ code: RpcErrorCode.BoardBindingNotAllowed }),
    );
    const bound = board.bind({
      projectId,
      messageId: created.message.messageId,
      confirmedByUser: true,
      rationale: 'Combat readability is a project requirement.',
    });
    expect(bound).toMatchObject({
      madeBy: { kind: 'user' },
      syncStatus: 'pending',
      syncAttempts: 0,
    });
    expect(() =>
      board.edit(projectId, created.message.messageId, 'Rewrite the binding decision.'),
    ).toThrow(expect.objectContaining({ code: RpcErrorCode.BoardMessageImmutable }));

    const replacement = board.post(
      {
        projectId,
        threadId: created.thread.threadId,
        type: 'decision',
        body: 'Every room must keep an escape route visible.',
      },
      { kind: 'user' },
    );
    const replacementDecision = board.bind({
      projectId,
      messageId: replacement.messageId,
      confirmedByUser: true,
      supersedes: bound.decisionId,
    });
    expect(replacementDecision.supersedes).toBe(bound.decisionId);
    expect(
      board.supersede(projectId, created.message.messageId, replacement.messageId).supersededBy,
    ).toBe(replacement.messageId);
    expect(() =>
      board.supersede(projectId, created.message.messageId, replacement.messageId),
    ).toThrow(expect.objectContaining({ code: RpcErrorCode.BoardMessageImmutable }));
  });

  it('searches thread title and messages, matches subscriptions, and archives without deleting history', () => {
    const { board, projectId } = createFixture();
    const { thread, message } = board.createThread(
      {
        projectId,
        title: 'Crystal cavern blocker',
        kind: 'blocker',
        tags: ['level-design'],
        body: 'The cavern encounter traps the player behind a locked gate.',
        type: 'blocker',
      },
      { kind: 'user' },
    );
    board.createThread(
      {
        projectId,
        title: 'Loot stash notes',
        kind: 'discussion',
        body: 'Crystal shards are precious.',
      },
      { kind: 'user' },
    );
    board.subscribe(
      projectId,
      { kind: 'agent', role: 'board-maintainer' },
      {
        tags: ['level-design'],
        kinds: ['blocker'],
        messageTypes: ['blocker'],
      },
    );
    expect(board.matchingSubscriptions(projectId, thread, message)).toHaveLength(1);
    expect(board.search(projectId, 'Crystal cavern').threads.map((item) => item.threadId)).toEqual([
      thread.threadId,
    ]);
    expect(board.search(projectId, 'locked gate').messages[0].messageId).toBe(message.messageId);
    expect(board.search(projectId, 'Crystal').threads[0]?.threadId).toBe(thread.threadId);
    board.setThreadStatus(projectId, thread.threadId, 'archived');
    expect(board.thread(projectId, thread.threadId).messages).toHaveLength(1);
    expect(board.thread(projectId, thread.threadId).thread.archivedAt).not.toBeNull();
  });

  it('requires explicit configuration before permanent thread deletion', () => {
    const { board, projectId, settings } = createFixture();
    const { thread } = board.createThread(
      {
        projectId,
        title: 'Retained discussion history',
        kind: 'discussion',
        body: 'Keep this thread unless deletion is configured.',
      },
      { kind: 'user' },
    );
    expect(() => board.deleteThread(projectId, thread.threadId)).toThrow(
      expect.objectContaining({ code: RpcErrorCode.BoardDeletionDisabled }),
    );
    settings.set('board.allowPermanentDeletion', 'project', true, { projectId });
    expect(board.deleteThread(projectId, thread.threadId)).toBe(true);
    expect(() => board.thread(projectId, thread.threadId)).toThrow(
      expect.objectContaining({ code: RpcErrorCode.BoardThreadNotFound }),
    );
  });
});
