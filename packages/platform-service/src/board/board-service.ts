import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  type BindingDecision,
  type BoardAuthor,
  type BoardLink,
  type BoardMessage,
  type BoardMessageType,
  type BoardSubscription,
  type BoardSubscriptionFilter,
  type BoardSubscriptionSubscriber,
  type BoardThread,
  type BoardThreadKind,
  type BoardThreadStatus,
  type CanonSyncProposal,
} from '@gamecrafter/contracts';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import { BoardStore, type BoardThreadFilter, type BoardMessagePage } from './board-store';

export interface BoardServiceEvents {
  threadChanged(projectId: string, thread: BoardThread): void;
  messagePosted(projectId: string, message: BoardMessage): void;
  decisionChanged(projectId: string, decision: BindingDecision): void;
}

export interface BoardServiceOptions {
  projectDatabases: ProjectDatabases;
  settings: SettingsService;
  events: BoardServiceEvents;
  now?: () => Date;
  onBindingDecision?: (decision: BindingDecision) => void | Promise<void>;
}

export interface BoardCreateThreadInput {
  projectId: string;
  title: string;
  kind: BoardThreadKind;
  tags?: string[];
  links?: BoardLink[];
  body: string;
  type?: BoardMessageType;
}

export interface BoardPostInput {
  projectId: string;
  threadId?: string;
  title?: string;
  kind?: BoardThreadKind;
  type: BoardMessageType;
  body: string;
  links?: BoardLink[];
  replyTo?: string | null;
}

export interface BoardBindInput {
  projectId: string;
  messageId: string;
  title?: string;
  statement?: string;
  rationale?: string | null;
  supersedes?: string | null;
  confirmedByUser?: boolean;
}

export class BoardService {
  private readonly now: () => Date;

  constructor(private readonly options: BoardServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  createThread(
    input: BoardCreateThreadInput,
    author: BoardAuthor,
  ): { thread: BoardThread; message: BoardMessage } {
    const store = this.store(input.projectId);
    const createdAt = this.now().toISOString();
    const threadId = uuidv7();
    const thread: BoardThread = {
      schemaVersion: 1,
      threadId,
      projectId: input.projectId,
      title: input.title.trim(),
      kind: input.kind,
      status: 'open',
      tags: uniqueStrings(input.tags ?? []),
      links: input.links ?? [],
      createdBy: author,
      createdAt,
      updatedAt: createdAt,
      lastMessageAt: createdAt,
      messageCount: 1,
      summary: null,
      summaryUpdatedAt: null,
      archivedAt: null,
    };
    const message: BoardMessage = {
      schemaVersion: 1,
      messageId: uuidv7(),
      threadId,
      projectId: input.projectId,
      seq: 1,
      type: input.type ?? 'comment',
      body: input.body,
      author,
      links: input.links ?? [],
      replyTo: null,
      createdAt,
      supersededBy: null,
      editHistory: [],
    };
    store.insertThread(thread, message);
    this.options.events.threadChanged(input.projectId, thread);
    this.options.events.messagePosted(input.projectId, message);
    return { thread, message };
  }

  post(input: BoardPostInput, author: BoardAuthor): BoardMessage {
    if (!input.threadId) {
      if (!input.title?.trim()) {
        throw new RpcError(
          'A title is required when creating a thread with board/post',
          RpcErrorCode.InvalidParams,
        );
      }
      return this.createThread(
        {
          projectId: input.projectId,
          title: input.title,
          kind: input.kind ?? 'discussion',
          links: input.links,
          body: input.body,
          type: input.type,
        },
        author,
      ).message;
    }

    const store = this.store(input.projectId);
    const thread = this.requireThread(store, input.projectId, input.threadId);
    if (thread.status === 'archived') {
      throw new RpcError(
        'Archived board threads cannot receive messages',
        RpcErrorCode.InvalidParams,
      );
    }
    if (input.replyTo) {
      const parent = store.getMessage(input.projectId, input.replyTo);
      if (!parent || parent.threadId !== thread.threadId) {
        throw new RpcError(
          `Board message not found: ${input.replyTo}`,
          RpcErrorCode.BoardMessageNotFound,
        );
      }
    }
    const now = this.now().toISOString();
    const message = store.insertMessage(
      {
        schemaVersion: 1,
        messageId: uuidv7(),
        threadId: thread.threadId,
        projectId: input.projectId,
        seq: 1,
        type: input.type,
        body: input.body,
        author,
        links: input.links ?? [],
        replyTo: input.replyTo ?? null,
        createdAt: now,
        supersededBy: null,
        editHistory: [],
      },
      thread.title,
    );
    this.options.events.messagePosted(input.projectId, message);
    const updatedThread = this.requireThread(store, input.projectId, thread.threadId);
    this.options.events.threadChanged(input.projectId, updatedThread);
    return message;
  }

  threads(projectId: string, filter: BoardThreadFilter & { search?: string } = {}): BoardThread[] {
    const store = this.store(projectId);
    if (!filter.search?.trim()) return store.listThreads(projectId, filter);
    const matchedThreads = new Set(
      this.search(projectId, filter.search, 1000).threads.map((thread) => thread.threadId),
    );
    return store
      .listThreads(projectId, { status: filter.status, kind: filter.kind, tags: filter.tags })
      .filter((thread) => matchedThreads.has(thread.threadId));
  }

  thread(
    projectId: string,
    threadId: string,
    options: BoardMessagePage & { includeMessages?: boolean } = {},
  ): { thread: BoardThread; messages: BoardMessage[] } {
    const store = this.store(projectId);
    const thread = this.requireThread(store, projectId, threadId);
    return {
      thread,
      messages:
        options.includeMessages === false ? [] : store.listMessages(projectId, threadId, options),
    };
  }

  edit(projectId: string, messageId: string, body: string): BoardMessage {
    const store = this.store(projectId);
    const existing = store.getMessage(projectId, messageId);
    if (!existing) {
      throw new RpcError(
        `Board message not found: ${messageId}`,
        RpcErrorCode.BoardMessageNotFound,
      );
    }
    if (store.getDecisionForMessage(projectId, messageId)) {
      throw new RpcError(
        'Binding decision messages cannot be edited',
        RpcErrorCode.BoardMessageImmutable,
      );
    }
    const updated: BoardMessage = {
      ...existing,
      body,
      editHistory: [
        ...existing.editHistory,
        { editedAt: this.now().toISOString(), previousBody: existing.body },
      ],
    };
    store.editMessage(updated);
    this.options.events.messagePosted(projectId, updated);
    this.options.events.threadChanged(
      projectId,
      this.requireThread(store, projectId, existing.threadId),
    );
    return updated;
  }

  supersede(projectId: string, messageId: string, byMessageId: string): BoardMessage {
    const store = this.store(projectId);
    const existing = store.getMessage(projectId, messageId);
    const replacement = store.getMessage(projectId, byMessageId);
    if (!existing) {
      throw new RpcError(
        `Board message not found: ${messageId}`,
        RpcErrorCode.BoardMessageNotFound,
      );
    }
    if (
      !replacement ||
      replacement.threadId !== existing.threadId ||
      replacement.messageId === existing.messageId ||
      replacement.supersededBy !== null
    ) {
      throw new RpcError(
        `Replacement message not found: ${byMessageId}`,
        RpcErrorCode.BoardMessageNotFound,
      );
    }
    if (existing.supersededBy !== null) {
      throw new RpcError(
        'Board message may be superseded only once',
        RpcErrorCode.BoardMessageImmutable,
      );
    }
    if (
      store.getDecisionForMessage(projectId, messageId) &&
      !store.getDecisionForMessage(projectId, byMessageId)
    ) {
      throw new RpcError(
        'A binding decision may only be superseded by another binding decision',
        RpcErrorCode.BoardMessageImmutable,
      );
    }
    const updated = { ...existing, supersededBy: replacement.messageId };
    store.supersedeMessage(updated, { kind: 'user' });
    this.options.events.messagePosted(projectId, updated);
    this.options.events.threadChanged(
      projectId,
      this.requireThread(store, projectId, existing.threadId),
    );
    return updated;
  }

  setThreadStatus(
    projectId: string,
    threadId: string,
    status: BoardThreadStatus,
    actor: BoardAuthor = { kind: 'user' },
  ): BoardThread {
    if (status === 'archived' && actor.kind === 'agent') {
      throw new RpcError('Agents cannot archive board threads', RpcErrorCode.InvalidParams);
    }
    const store = this.store(projectId);
    const existing = this.requireThread(store, projectId, threadId);
    const now = this.now().toISOString();
    const updated: BoardThread = {
      ...existing,
      status,
      updatedAt: now,
      archivedAt: status === 'archived' ? (existing.archivedAt ?? now) : null,
    };
    store.setThread(
      updated,
      status === 'archived' ? 'board.thread.archived' : 'board.thread.status_changed',
      actor,
    );
    this.options.events.threadChanged(projectId, updated);
    return updated;
  }

  bind(input: BoardBindInput): BindingDecision {
    if (input.confirmedByUser !== true) {
      throw new RpcError(
        'Only a confirmed user action can bind a board decision',
        RpcErrorCode.BoardBindingNotAllowed,
      );
    }
    const store = this.store(input.projectId);
    const message = store.getMessage(input.projectId, input.messageId);
    if (!message) {
      throw new RpcError(
        `Board message not found: ${input.messageId}`,
        RpcErrorCode.BoardMessageNotFound,
      );
    }
    const existing = store.getDecisionForMessage(input.projectId, input.messageId);
    if (existing) return existing;
    if (message.type !== 'decision' && message.type !== 'proposal') {
      throw new RpcError(
        'Only proposal or decision messages can be bound',
        RpcErrorCode.BoardBindingNotAllowed,
      );
    }
    if (input.supersedes && !store.getDecision(input.projectId, input.supersedes)) {
      throw new RpcError(
        `Board decision not found: ${input.supersedes}`,
        RpcErrorCode.BoardDecisionNotFound,
      );
    }
    const thread = this.requireThread(store, input.projectId, message.threadId);
    const decision: BindingDecision = {
      schemaVersion: 1,
      decisionId: uuidv7(),
      projectId: input.projectId,
      threadId: message.threadId,
      messageId: message.messageId,
      title: input.title?.trim() || thread.title,
      statement: input.statement?.trim() || message.body,
      rationale: input.rationale ?? null,
      madeBy: { kind: 'user' },
      boundAt: this.now().toISOString(),
      supersedes: input.supersedes ?? null,
      syncStatus: 'pending',
      syncAttempts: 0,
      lastSyncError: null,
      syncedAt: null,
      canonRecordPath: null,
      canonCommit: null,
    };
    store.insertDecision(decision);
    this.options.events.decisionChanged(input.projectId, decision);
    void this.options.onBindingDecision?.(decision);
    return decision;
  }

  decisions(projectId: string, syncStatus?: BindingDecision['syncStatus']): BindingDecision[] {
    return this.store(projectId).listDecisions(projectId, syncStatus);
  }

  decision(projectId: string, decisionId: string): BindingDecision {
    const decision = this.store(projectId).getDecision(projectId, decisionId);
    if (!decision) {
      throw new RpcError(
        `Board decision not found: ${decisionId}`,
        RpcErrorCode.BoardDecisionNotFound,
      );
    }
    return decision;
  }

  updateDecision(decision: BindingDecision, eventKind?: string): void {
    this.store(decision.projectId).updateDecision(decision, eventKind);
    this.options.events.decisionChanged(decision.projectId, decision);
  }

  addProposal(proposal: CanonSyncProposal): void {
    this.store(proposal.projectId).insertProposal(proposal);
  }

  markProposalsApplied(
    projectId: string,
    decisionId: string,
    appliedAt: string,
    commit: string,
  ): void {
    this.store(projectId).markProposalsApplied(projectId, decisionId, appliedAt, commit);
  }

  proposals(projectId: string, decisionId: string): CanonSyncProposal[] {
    return this.store(projectId).listProposals(projectId, decisionId);
  }

  subscribe(
    projectId: string,
    subscriber: BoardSubscriptionSubscriber,
    filter: BoardSubscriptionFilter = {},
  ): BoardSubscription {
    const subscription: BoardSubscription = {
      subscriptionId: uuidv7(),
      projectId,
      subscriber,
      filter,
      createdAt: this.now().toISOString(),
    };
    this.store(projectId).insertSubscription(subscription);
    return subscription;
  }

  unsubscribe(projectId: string, subscriptionId: string): boolean {
    return this.store(projectId).removeSubscription(projectId, subscriptionId);
  }

  subscriptions(projectId: string, subscriber?: BoardSubscriptionSubscriber): BoardSubscription[] {
    return this.store(projectId)
      .listSubscriptions(projectId)
      .filter((item) => !subscriber || sameSubscriber(item.subscriber, subscriber));
  }

  matchingSubscriptions(
    projectId: string,
    thread: BoardThread,
    message: BoardMessage,
  ): BoardSubscription[] {
    return this.subscriptions(projectId).filter((subscription) => {
      const filter = subscription.filter;
      return (
        (!filter.threadIds?.length || filter.threadIds.includes(thread.threadId)) &&
        (!filter.tags?.length || filter.tags.some((tag) => thread.tags.includes(tag))) &&
        (!filter.kinds?.length || filter.kinds.includes(thread.kind)) &&
        (!filter.messageTypes?.length || filter.messageTypes.includes(message.type))
      );
    });
  }

  summary(
    projectId: string,
    threadId: string,
  ): { summary: string | null; summaryUpdatedAt: string | null } {
    const thread = this.requireThread(this.store(projectId), projectId, threadId);
    return { summary: thread.summary, summaryUpdatedAt: thread.summaryUpdatedAt };
  }

  setSummary(projectId: string, threadId: string, summary: string): BoardThread {
    const store = this.store(projectId);
    const thread = this.requireThread(store, projectId, threadId);
    const now = this.now().toISOString();
    const updated = { ...thread, summary, summaryUpdatedAt: now, updatedAt: now };
    store.setThread(updated, 'board.thread.summary_updated', { kind: 'system' });
    const message = store.insertMessage(
      {
        schemaVersion: 1,
        messageId: uuidv7(),
        threadId,
        projectId,
        seq: 1,
        type: 'summary',
        body: summary,
        author: { kind: 'system' },
        links: [],
        replyTo: null,
        createdAt: now,
        supersededBy: null,
        editHistory: [],
      },
      thread.title,
    );
    this.options.events.messagePosted(projectId, message);
    const result = this.requireThread(store, projectId, threadId);
    this.options.events.threadChanged(projectId, result);
    return result;
  }

  search(
    projectId: string,
    query: string,
    limit = 100,
  ): { threads: BoardThread[]; messages: BoardMessage[] } {
    const fts = ftsQuery(query);
    if (!fts) return { threads: [], messages: [] };
    const store = this.store(projectId);
    const messages = store.searchMessages(projectId, fts, Math.max(1, Math.min(limit, 1000)));
    const seen = new Set<string>();
    const threads = messages
      .map((message) => message.threadId)
      .filter((threadId) => {
        if (seen.has(threadId)) return false;
        seen.add(threadId);
        return true;
      })
      .map((threadId) => store.getThread(projectId, threadId))
      .filter((thread): thread is BoardThread => thread !== undefined);
    return { threads, messages };
  }

  deleteThread(projectId: string, threadId: string): boolean {
    const allowed = this.options.settings.resolve('board.allowPermanentDeletion', {
      projectId,
    }).value;
    if (allowed !== true) {
      throw new RpcError(
        'Permanent board deletion is disabled',
        RpcErrorCode.BoardDeletionDisabled,
      );
    }
    const store = this.store(projectId);
    if (!this.requireThread(store, projectId, threadId)) return false;
    return store.deleteThread(projectId, threadId);
  }

  setMaintenanceState(
    projectId: string,
    patch: Parameters<BoardStore['setMaintenanceState']>[1],
  ): void {
    this.store(projectId).setMaintenanceState(projectId, patch);
  }

  recordMaintenanceCompleted(projectId: string, mode: string, taskId: string): void {
    this.store(projectId).recordMaintenanceCompleted(projectId, mode, taskId);
  }

  maintenanceStatus(projectId: string): {
    lastAuditAt: string | null;
    lastCleanupAt: string | null;
    nextAuditAt: string | null;
    pendingDecisions: number;
    runningTaskId: string | null;
  } {
    const store = this.store(projectId);
    const state = store.getMaintenanceState(projectId);
    return {
      lastAuditAt: state?.lastAuditAt ?? null,
      lastCleanupAt: state?.lastCleanupAt ?? null,
      nextAuditAt: state?.nextAuditAt ?? null,
      pendingDecisions: store
        .listDecisions(projectId)
        .filter((decision) => decision.syncStatus === 'pending' || decision.syncStatus === 'failed')
        .length,
      runningTaskId: state?.runningTaskId ?? null,
    };
  }

  private store(projectId: string): BoardStore {
    return new BoardStore(this.options.projectDatabases.get(projectId), this.now);
  }

  private requireThread(store: BoardStore, projectId: string, threadId: string): BoardThread {
    const thread = store.getThread(projectId, threadId);
    if (!thread) {
      throw new RpcError(`Board thread not found: ${threadId}`, RpcErrorCode.BoardThreadNotFound);
    }
    return thread;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sameSubscriber(
  left: BoardSubscriptionSubscriber,
  right: BoardSubscriptionSubscriber,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'user' || right.kind === 'user') return true;
  return left.kind === 'agent'
    ? left.role === (right as typeof left).role
    : left.taskId === (right as typeof left).taskId;
}

function ftsQuery(query: string): string {
  const tokens = query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(' AND ');
}
