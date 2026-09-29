import { describe, expect, it } from 'vitest';
import { uuidv7 } from '../ids';
import { compile } from '../validation';
import {
  BindingDecisionSchema,
  BoardMessageSchema,
  BoardSubscriptionSchema,
  BoardThreadSchema,
} from './schema';

const projectId = uuidv7();
const threadId = uuidv7();
const messageId = uuidv7();
const now = '2026-09-28T12:00:00.000Z';

const userAuthor = { kind: 'user' as const };

describe('discussion board contracts', () => {
  it('accepts a linked thread with explicit lifecycle and derived summary metadata', () => {
    expect(
      compile(BoardThreadSchema).check({
        schemaVersion: 1,
        threadId,
        projectId,
        title: 'Combat encounter blockers',
        kind: 'blocker',
        status: 'open',
        tags: ['combat', 'encounter'],
        links: [{ kind: 'task', ref: uuidv7() }],
        createdBy: userAuthor,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        messageCount: 1,
        summary: null,
        summaryUpdatedAt: null,
        archivedAt: null,
      }),
    ).toBe(true);
  });

  it('accepts sequenced messages, edit history, supersession, and agent authors', () => {
    expect(
      compile(BoardMessageSchema).check({
        schemaVersion: 1,
        messageId,
        threadId,
        projectId,
        seq: 1,
        type: 'finding',
        body: 'The encounter has no exit path.',
        author: { kind: 'agent', role: 'explorer', taskId: uuidv7() },
        links: [{ kind: 'artifact', ref: 'game/rooms/crypt.tscn' }],
        replyTo: null,
        createdAt: now,
        supersededBy: null,
        editHistory: [{ editedAt: now, previousBody: 'An earlier finding.' }],
      }),
    ).toBe(true);
  });

  it('accepts only an explicit binding decision record and subscription filters', () => {
    expect(
      compile(BindingDecisionSchema).check({
        schemaVersion: 1,
        decisionId: uuidv7(),
        projectId,
        threadId,
        messageId,
        title: 'Preserve the escape route',
        statement: 'Every combat room must have a readable escape path.',
        rationale: null,
        madeBy: userAuthor,
        boundAt: now,
        supersedes: null,
        syncStatus: 'pending',
        syncAttempts: 0,
        lastSyncError: null,
        syncedAt: null,
        canonRecordPath: null,
        canonCommit: null,
      }),
    ).toBe(true);
    expect(
      compile(BoardSubscriptionSchema).check({
        subscriptionId: uuidv7(),
        projectId,
        subscriber: { kind: 'agent', role: 'board-maintainer' },
        filter: { tags: ['combat'], kinds: ['decision', 'blocker'], messageTypes: ['finding'] },
        createdAt: now,
      }),
    ).toBe(true);
  });
});
