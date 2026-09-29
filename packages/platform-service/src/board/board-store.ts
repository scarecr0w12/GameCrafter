import {
  uuidv7,
  type BindingDecision,
  type BoardLink,
  type BoardMessage,
  type BoardSubscription,
  type BoardThread,
  type CanonSyncProposal,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';

export interface BoardThreadFilter {
  status?: BoardThread['status'];
  kind?: BoardThread['kind'];
  tags?: string[];
}

export interface BoardMessagePage {
  afterSeq?: number;
  limit?: number;
}

interface ThreadRow {
  schemaVersion: number;
  threadId: string;
  projectId: string;
  title: string;
  kind: BoardThread['kind'];
  status: BoardThread['status'];
  tags: string;
  links: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
  summary: string | null;
  summaryUpdatedAt: string | null;
  archivedAt: string | null;
}

interface MessageRow {
  schemaVersion: number;
  messageId: string;
  threadId: string;
  projectId: string;
  seq: number;
  type: BoardMessage['type'];
  body: string;
  author: string;
  links: string;
  replyTo: string | null;
  createdAt: string;
  supersededBy: string | null;
  editHistory: string;
}

interface DecisionRow {
  schemaVersion: number;
  decisionId: string;
  projectId: string;
  threadId: string;
  messageId: string;
  title: string;
  statement: string;
  rationale: string | null;
  madeBy: string;
  boundAt: string;
  supersedes: string | null;
  syncStatus: BindingDecision['syncStatus'];
  syncAttempts: number;
  lastSyncError: string | null;
  syncedAt: string | null;
  canonRecordPath: string | null;
  canonCommit: string | null;
}

interface SubscriptionRow {
  subscriptionId: string;
  projectId: string;
  subscriber: string;
  filter: string;
  createdAt: string;
}

interface ProposalRow {
  proposalId: string;
  decisionId: string;
  projectId: string;
  path: string;
  beforeContent: string | null;
  afterContent: string;
  diff: string;
  createdAt: string;
  appliedAt: string | null;
  commitSha: string | null;
}

const threadColumns = `schema_version AS schemaVersion, thread_id AS threadId, project_id AS projectId,
  title, kind, status, tags, links, created_by AS createdBy, created_at AS createdAt,
  updated_at AS updatedAt, last_message_at AS lastMessageAt, message_count AS messageCount,
  summary, summary_updated_at AS summaryUpdatedAt, archived_at AS archivedAt`;
const messageColumns = `schema_version AS schemaVersion, message_id AS messageId, thread_id AS threadId,
  project_id AS projectId, seq, type, body, author, links, reply_to AS replyTo,
  created_at AS createdAt, superseded_by AS supersededBy, edit_history AS editHistory`;
const decisionColumns = `schema_version AS schemaVersion, decision_id AS decisionId,
  project_id AS projectId, thread_id AS threadId, message_id AS messageId, title, statement,
  rationale, made_by AS madeBy, bound_at AS boundAt, supersedes, sync_status AS syncStatus,
  sync_attempts AS syncAttempts, last_sync_error AS lastSyncError, synced_at AS syncedAt,
  canon_record_path AS canonRecordPath, canon_commit AS canonCommit`;
const subscriptionColumns = `subscription_id AS subscriptionId, project_id AS projectId,
  subscriber, filter, created_at AS createdAt`;

export class BoardStore {
  constructor(
    private readonly database: Database,
    private readonly now: () => Date,
  ) {}

  insertThread(thread: BoardThread, firstMessage: BoardMessage): void {
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO board_threads
            (thread_id, schema_version, project_id, title, kind, status, tags, links,
             created_by, created_at, updated_at, last_message_at, message_count,
             summary, summary_updated_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          thread.threadId,
          thread.schemaVersion,
          thread.projectId,
          thread.title,
          thread.kind,
          thread.status,
          JSON.stringify(thread.tags),
          JSON.stringify(thread.links),
          JSON.stringify(thread.createdBy),
          thread.createdAt,
          thread.updatedAt,
          thread.lastMessageAt,
          thread.messageCount,
          thread.summary,
          thread.summaryUpdatedAt,
          thread.archivedAt,
        );
      this.insertMessageRow(firstMessage, thread.title);
      this.appendProjectEvent('board.thread.created', thread.createdBy, {
        threadId: thread.threadId,
        title: thread.title,
        kind: thread.kind,
      });
      this.appendProjectEvent('board.message.posted', firstMessage.author, {
        threadId: thread.threadId,
        messageId: firstMessage.messageId,
        seq: firstMessage.seq,
      });
    });
  }

  insertMessage(message: BoardMessage, threadTitle: string): BoardMessage {
    return this.database.transaction(() => {
      const seq =
        this.database
          .prepare(
            'SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq FROM board_messages WHERE thread_id = ?',
          )
          .get<{ nextSeq: number }>(message.threadId)?.nextSeq ?? 1;
      const sequenced = { ...message, seq };
      this.insertMessageRow(sequenced, threadTitle);
      this.database
        .prepare(
          `UPDATE board_threads
           SET message_count = message_count + 1, last_message_at = ?, updated_at = ?
           WHERE project_id = ? AND thread_id = ?`,
        )
        .run(sequenced.createdAt, sequenced.createdAt, sequenced.projectId, sequenced.threadId);
      this.appendProjectEvent('board.message.posted', sequenced.author, {
        threadId: sequenced.threadId,
        messageId: sequenced.messageId,
        seq,
      });
      return sequenced;
    });
  }

  getThread(projectId: string, threadId: string): BoardThread | undefined {
    const row = this.database
      .prepare(`SELECT ${threadColumns} FROM board_threads WHERE project_id = ? AND thread_id = ?`)
      .get<ThreadRow>(projectId, threadId);
    return row ? threadFromRow(row) : undefined;
  }

  listThreads(projectId: string, filter: BoardThreadFilter = {}): BoardThread[] {
    const conditions = ['project_id = ?'];
    const parameters: Array<string | number> = [projectId];
    if (filter.status) {
      conditions.push('status = ?');
      parameters.push(filter.status);
    }
    if (filter.kind) {
      conditions.push('kind = ?');
      parameters.push(filter.kind);
    }
    const rows = this.database
      .prepare(
        `SELECT ${threadColumns} FROM board_threads WHERE ${conditions.join(' AND ')}
         ORDER BY last_message_at DESC, thread_id`,
      )
      .all<ThreadRow>(...parameters);
    return rows
      .map(threadFromRow)
      .filter(
        (thread) => !filter.tags?.length || filter.tags.every((tag) => thread.tags.includes(tag)),
      );
  }

  getMessage(projectId: string, messageId: string): BoardMessage | undefined {
    const row = this.database
      .prepare(
        `SELECT ${messageColumns} FROM board_messages WHERE project_id = ? AND message_id = ?`,
      )
      .get<MessageRow>(projectId, messageId);
    return row ? messageFromRow(row) : undefined;
  }

  listMessages(projectId: string, threadId: string, page: BoardMessagePage = {}): BoardMessage[] {
    const afterSeq = page.afterSeq ?? 0;
    const limit = Math.max(1, Math.min(page.limit ?? 200, 1000));
    return this.database
      .prepare(
        `SELECT ${messageColumns} FROM board_messages
         WHERE project_id = ? AND thread_id = ? AND seq > ?
         ORDER BY seq LIMIT ?`,
      )
      .all<MessageRow>(projectId, threadId, afterSeq, limit)
      .map(messageFromRow);
  }

  editMessage(message: BoardMessage): void {
    this.database.transaction(() => {
      this.database
        .prepare(
          `UPDATE board_messages SET body = ?, edit_history = ?
           WHERE project_id = ? AND message_id = ?`,
        )
        .run(
          message.body,
          JSON.stringify(message.editHistory),
          message.projectId,
          message.messageId,
        );
      this.database
        .prepare('UPDATE board_threads SET updated_at = ? WHERE project_id = ? AND thread_id = ?')
        .run(
          message.editHistory.at(-1)?.editedAt ?? this.now().toISOString(),
          message.projectId,
          message.threadId,
        );
      this.appendProjectEvent('board.message.edited', message.author, {
        threadId: message.threadId,
        messageId: message.messageId,
      });
    });
  }

  supersedeMessage(message: BoardMessage, actor: BoardMessage['author']): void {
    this.database.transaction(() => {
      this.database
        .prepare(
          'UPDATE board_messages SET superseded_by = ? WHERE project_id = ? AND message_id = ?',
        )
        .run(message.supersededBy, message.projectId, message.messageId);
      this.database
        .prepare('UPDATE board_threads SET updated_at = ? WHERE project_id = ? AND thread_id = ?')
        .run(this.now().toISOString(), message.projectId, message.threadId);
      this.appendProjectEvent('board.message.superseded', actor, {
        threadId: message.threadId,
        messageId: message.messageId,
        supersededBy: message.supersededBy,
      });
    });
  }

  setThread(thread: BoardThread, eventKind: string, actor: BoardThread['createdBy']): void {
    this.database.transaction(() => {
      this.database
        .prepare(
          `UPDATE board_threads SET status = ?, updated_at = ?, archived_at = ?,
             summary = ?, summary_updated_at = ?
           WHERE project_id = ? AND thread_id = ?`,
        )
        .run(
          thread.status,
          thread.updatedAt,
          thread.archivedAt,
          thread.summary,
          thread.summaryUpdatedAt,
          thread.projectId,
          thread.threadId,
        );
      this.appendProjectEvent(eventKind, actor, {
        threadId: thread.threadId,
        status: thread.status,
      });
    });
  }

  insertDecision(decision: BindingDecision): void {
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO board_decisions
            (decision_id, schema_version, project_id, thread_id, message_id, title, statement,
             rationale, made_by, bound_at, supersedes, sync_status, sync_attempts,
             last_sync_error, synced_at, canon_record_path, canon_commit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          decision.decisionId,
          decision.schemaVersion,
          decision.projectId,
          decision.threadId,
          decision.messageId,
          decision.title,
          decision.statement,
          decision.rationale,
          JSON.stringify(decision.madeBy),
          decision.boundAt,
          decision.supersedes,
          decision.syncStatus,
          decision.syncAttempts,
          decision.lastSyncError,
          decision.syncedAt,
          decision.canonRecordPath,
          decision.canonCommit,
        );
      this.appendProjectEvent('board.decision.bound', decision.madeBy, {
        decisionId: decision.decisionId,
        threadId: decision.threadId,
        messageId: decision.messageId,
      });
    });
  }

  updateDecision(decision: BindingDecision, eventKind?: string): void {
    this.database.transaction(() => {
      this.database
        .prepare(
          `UPDATE board_decisions SET sync_status = ?, sync_attempts = ?, last_sync_error = ?,
             synced_at = ?, canon_record_path = ?, canon_commit = ?
           WHERE project_id = ? AND decision_id = ?`,
        )
        .run(
          decision.syncStatus,
          decision.syncAttempts,
          decision.lastSyncError,
          decision.syncedAt,
          decision.canonRecordPath,
          decision.canonCommit,
          decision.projectId,
          decision.decisionId,
        );
      if (eventKind) {
        this.appendProjectEvent(
          eventKind,
          { kind: 'system' },
          {
            decisionId: decision.decisionId,
            syncStatus: decision.syncStatus,
            lastSyncError: decision.lastSyncError,
          },
        );
      }
    });
  }

  getDecision(projectId: string, decisionId: string): BindingDecision | undefined {
    const row = this.database
      .prepare(
        `SELECT ${decisionColumns} FROM board_decisions WHERE project_id = ? AND decision_id = ?`,
      )
      .get<DecisionRow>(projectId, decisionId);
    return row ? decisionFromRow(row) : undefined;
  }

  getDecisionForMessage(projectId: string, messageId: string): BindingDecision | undefined {
    const row = this.database
      .prepare(
        `SELECT ${decisionColumns} FROM board_decisions WHERE project_id = ? AND message_id = ?`,
      )
      .get<DecisionRow>(projectId, messageId);
    return row ? decisionFromRow(row) : undefined;
  }

  listDecisions(projectId: string, syncStatus?: BindingDecision['syncStatus']): BindingDecision[] {
    const rows = syncStatus
      ? this.database
          .prepare(
            `SELECT ${decisionColumns} FROM board_decisions WHERE project_id = ? AND sync_status = ? ORDER BY bound_at`,
          )
          .all<DecisionRow>(projectId, syncStatus)
      : this.database
          .prepare(
            `SELECT ${decisionColumns} FROM board_decisions WHERE project_id = ? ORDER BY bound_at`,
          )
          .all<DecisionRow>(projectId);
    return rows.map(decisionFromRow);
  }

  insertProposal(proposal: CanonSyncProposal): void {
    this.database
      .prepare(
        `INSERT INTO canon_sync_proposals
          (proposal_id, decision_id, project_id, path, before_content, after_content,
           diff, created_at, applied_at, commit_sha)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        proposal.proposalId,
        proposal.decisionId,
        proposal.projectId,
        proposal.path,
        proposal.before,
        proposal.after,
        proposal.diff,
        proposal.createdAt,
        proposal.appliedAt,
        proposal.commit,
      );
  }

  markProposalsApplied(
    projectId: string,
    decisionId: string,
    appliedAt: string,
    commit: string,
  ): void {
    this.database
      .prepare(
        `UPDATE canon_sync_proposals SET applied_at = ?, commit_sha = ?
         WHERE project_id = ? AND decision_id = ?`,
      )
      .run(appliedAt, commit, projectId, decisionId);
  }

  listProposals(projectId: string, decisionId: string): CanonSyncProposal[] {
    return this.database
      .prepare(
        `SELECT proposal_id AS proposalId, decision_id AS decisionId, project_id AS projectId,
          path, before_content AS beforeContent, after_content AS afterContent, diff,
          created_at AS createdAt, applied_at AS appliedAt, commit_sha AS commitSha
         FROM canon_sync_proposals WHERE project_id = ? AND decision_id = ?
         ORDER BY created_at, proposal_id`,
      )
      .all<ProposalRow>(projectId, decisionId)
      .map((row) => ({
        proposalId: row.proposalId,
        decisionId: row.decisionId,
        projectId: row.projectId,
        path: row.path,
        before: row.beforeContent,
        after: row.afterContent,
        diff: row.diff,
        createdAt: row.createdAt,
        appliedAt: row.appliedAt,
        commit: row.commitSha,
      }));
  }

  insertSubscription(subscription: BoardSubscription): void {
    this.database
      .prepare(
        `INSERT INTO board_subscriptions (subscription_id, project_id, subscriber, filter, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        subscription.subscriptionId,
        subscription.projectId,
        JSON.stringify(subscription.subscriber),
        JSON.stringify(subscription.filter),
        subscription.createdAt,
      );
  }

  removeSubscription(projectId: string, subscriptionId: string): boolean {
    const existing = this.database
      .prepare(
        'SELECT 1 AS found FROM board_subscriptions WHERE project_id = ? AND subscription_id = ?',
      )
      .get(projectId, subscriptionId);
    if (!existing) return false;
    this.database
      .prepare('DELETE FROM board_subscriptions WHERE project_id = ? AND subscription_id = ?')
      .run(projectId, subscriptionId);
    return true;
  }

  listSubscriptions(projectId: string): BoardSubscription[] {
    return this.database
      .prepare(
        `SELECT ${subscriptionColumns} FROM board_subscriptions WHERE project_id = ? ORDER BY created_at`,
      )
      .all<SubscriptionRow>(projectId)
      .map((row) => ({
        subscriptionId: row.subscriptionId,
        projectId: row.projectId,
        subscriber: parseJson<BoardSubscription['subscriber']>(row.subscriber),
        filter: parseJson<BoardSubscription['filter']>(row.filter),
        createdAt: row.createdAt,
      }));
  }

  searchMessages(projectId: string, match: string, limit: number): BoardMessage[] {
    const rows = this.database
      .prepare(
        `SELECT ${messageColumns.replaceAll(', ', ', m.')} FROM board_messages_fts f
         JOIN board_messages m ON m.rowid = f.rowid
         WHERE board_messages_fts MATCH ? AND m.project_id = ?
         ORDER BY bm25(board_messages_fts, 1.0, 2.0), m.created_at DESC LIMIT ?`,
      )
      .all<MessageRow>(match, projectId, limit);
    return rows.map(messageFromRow);
  }

  deleteThread(projectId: string, threadId: string): boolean {
    return Boolean(
      this.database
        .prepare('DELETE FROM board_threads WHERE project_id = ? AND thread_id = ?')
        .run(projectId, threadId),
    );
  }

  getMaintenanceState(projectId: string):
    | {
        lastAuditAt: string | null;
        lastCleanupAt: string | null;
        nextAuditAt: string | null;
        runningTaskId: string | null;
      }
    | undefined {
    return this.database
      .prepare(
        `SELECT last_audit_at AS lastAuditAt, last_cleanup_at AS lastCleanupAt,
          next_audit_at AS nextAuditAt, running_task_id AS runningTaskId
         FROM board_maintenance_state WHERE project_id = ?`,
      )
      .get(projectId);
  }

  setMaintenanceState(
    projectId: string,
    patch: {
      lastAuditAt?: string | null;
      lastCleanupAt?: string | null;
      nextAuditAt?: string | null;
      runningTaskId?: string | null;
    },
  ): void {
    const current = this.getMaintenanceState(projectId) ?? {
      lastAuditAt: null,
      lastCleanupAt: null,
      nextAuditAt: null,
      runningTaskId: null,
    };
    this.database
      .prepare(
        `INSERT INTO board_maintenance_state
          (project_id, last_audit_at, last_cleanup_at, next_audit_at, running_task_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           last_audit_at = excluded.last_audit_at,
           last_cleanup_at = excluded.last_cleanup_at,
           next_audit_at = excluded.next_audit_at,
           running_task_id = excluded.running_task_id`,
      )
      .run(
        projectId,
        patch.lastAuditAt === undefined ? current.lastAuditAt : patch.lastAuditAt,
        patch.lastCleanupAt === undefined ? current.lastCleanupAt : patch.lastCleanupAt,
        patch.nextAuditAt === undefined ? current.nextAuditAt : patch.nextAuditAt,
        patch.runningTaskId === undefined ? current.runningTaskId : patch.runningTaskId,
      );
  }

  recordMaintenanceCompleted(projectId: string, mode: string, taskId: string): void {
    this.appendProjectEvent('board.maintenance.completed', { kind: 'system' }, { mode, taskId });
  }

  private insertMessageRow(message: BoardMessage, threadTitle: string): void {
    this.database
      .prepare(
        `INSERT INTO board_messages
          (message_id, schema_version, thread_id, project_id, seq, type, body, author, links,
           reply_to, created_at, superseded_by, edit_history, thread_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.messageId,
        message.schemaVersion,
        message.threadId,
        message.projectId,
        message.seq,
        message.type,
        message.body,
        JSON.stringify(message.author),
        JSON.stringify(message.links),
        message.replyTo,
        message.createdAt,
        message.supersededBy,
        JSON.stringify(message.editHistory),
        threadTitle,
      );
  }

  private appendProjectEvent(
    kind: string,
    actor: BoardThread['createdBy'] | BoardMessage['author'],
    payload: unknown,
  ): void {
    const occurredAt = this.now().toISOString();
    const seq =
      this.database
        .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM events')
        .get<{ seq: number }>()?.seq ?? 1;
    this.database
      .prepare(
        `INSERT INTO events (event_id, seq, task_id, kind, occurred_at, actor, payload)
         VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      )
      .run(uuidv7(), seq, kind, occurredAt, authorKey(actor), JSON.stringify(payload));
  }
}

function threadFromRow(row: ThreadRow): BoardThread {
  return {
    schemaVersion: 1,
    threadId: row.threadId,
    projectId: row.projectId,
    title: row.title,
    kind: row.kind,
    status: row.status,
    tags: parseJson<string[]>(row.tags),
    links: parseJson<BoardLink[]>(row.links),
    createdBy: parseJson<BoardThread['createdBy']>(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt,
    messageCount: row.messageCount,
    summary: row.summary,
    summaryUpdatedAt: row.summaryUpdatedAt,
    archivedAt: row.archivedAt,
  };
}

function messageFromRow(row: MessageRow): BoardMessage {
  return {
    schemaVersion: 1,
    messageId: row.messageId,
    threadId: row.threadId,
    projectId: row.projectId,
    seq: row.seq,
    type: row.type,
    body: row.body,
    author: parseJson<BoardMessage['author']>(row.author),
    links: parseJson<BoardLink[]>(row.links),
    replyTo: row.replyTo,
    createdAt: row.createdAt,
    supersededBy: row.supersededBy,
    editHistory: parseJson<BoardMessage['editHistory']>(row.editHistory),
  };
}

function decisionFromRow(row: DecisionRow): BindingDecision {
  return {
    schemaVersion: 1,
    decisionId: row.decisionId,
    projectId: row.projectId,
    threadId: row.threadId,
    messageId: row.messageId,
    title: row.title,
    statement: row.statement,
    rationale: row.rationale,
    madeBy: parseJson<BindingDecision['madeBy']>(row.madeBy),
    boundAt: row.boundAt,
    supersedes: row.supersedes,
    syncStatus: row.syncStatus,
    syncAttempts: row.syncAttempts,
    lastSyncError: row.lastSyncError,
    syncedAt: row.syncedAt,
    canonRecordPath: row.canonRecordPath,
    canonCommit: row.canonCommit,
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function authorKey(author: BoardThread['createdBy'] | BoardMessage['author']): string {
  return author.kind === 'agent' ? `agent:${author.role}` : author.kind;
}
