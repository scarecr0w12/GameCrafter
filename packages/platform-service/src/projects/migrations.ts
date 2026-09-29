import type { Migration } from '../db/migrator';

export const projectMigrations: Migration[] = [
  {
    id: 1,
    name: 'create project operational tables',
    up: `
      CREATE TABLE project_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE events (
        event_id TEXT PRIMARY KEY,
        seq INTEGER NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        actor TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE settings_overrides (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'create task and question tables',
    up: `
      ALTER TABLE events ADD COLUMN task_id TEXT;
      CREATE INDEX events_task_id_idx ON events(task_id);
      CREATE TABLE tasks (
        task_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        project_id TEXT NOT NULL,
        parent_task_id TEXT,
        root_task_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        goal_hash TEXT NOT NULL,
        state TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 50,
        depends_on TEXT NOT NULL,
        assignee TEXT,
        budget TEXT NOT NULL,
        spent TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        lease TEXT,
        input TEXT NOT NULL,
        checkpoint TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE INDEX tasks_goal_hash_idx ON tasks(goal_hash);
      CREATE INDEX tasks_state_idx ON tasks(state);
      CREATE INDEX tasks_parent_task_id_idx ON tasks(parent_task_id);
      CREATE INDEX tasks_root_task_id_idx ON tasks(root_task_id);
      CREATE TABLE task_questions (
        question_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        options TEXT,
        asked_at TEXT NOT NULL,
        answer TEXT NOT NULL,
        answered_at TEXT
      );
      CREATE INDEX task_questions_task_id_idx ON task_questions(task_id);
      CREATE INDEX task_questions_answered_at_idx ON task_questions(answered_at);
    `,
  },
  {
    id: 3,
    name: 'create tool broker tables',
    up: `
      CREATE TABLE tool_calls (
        call_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT,
        agent_id TEXT,
        tool_id TEXT NOT NULL,
        input TEXT NOT NULL,
        access_mode TEXT NOT NULL,
        decision TEXT NOT NULL,
        decision_reason TEXT NOT NULL,
        status TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT,
        evidence TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE INDEX tool_calls_task_id_idx ON tool_calls(task_id);
      CREATE INDEX tool_calls_tool_id_idx ON tool_calls(tool_id);
      CREATE INDEX tool_calls_status_idx ON tool_calls(status);
      CREATE TABLE approvals (
        approval_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        call_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        side_effects TEXT NOT NULL,
        summary TEXT NOT NULL,
        input TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        resolved_at TEXT,
        approved INTEGER,
        reason TEXT
      );
      CREATE INDEX approvals_project_pending_idx ON approvals(project_id, resolved_at);
    `,
  },
  {
    id: 4,
    name: 'create skill enablement and activation tables',
    up: `
      CREATE TABLE skill_enablement (
        name TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL,
        pinned_version TEXT,
        pinned_hash TEXT,
        roles TEXT,
        work_types TEXT
      );
      CREATE TABLE skill_activations (
        activation_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT,
        hash TEXT NOT NULL,
        task_id TEXT,
        agent_id TEXT,
        model_id TEXT,
        activated_at TEXT NOT NULL
      );
      CREATE INDEX skill_activations_name_task_idx ON skill_activations(name, task_id);
      CREATE INDEX skill_activations_task_idx ON skill_activations(task_id);
    `,
  },
  {
    id: 5,
    name: 'create discussion board and maintenance tables',
    up: `
      CREATE TABLE board_threads (
        thread_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        links TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        summary TEXT,
        summary_updated_at TEXT,
        archived_at TEXT
      );
      CREATE INDEX board_threads_project_status_idx ON board_threads(project_id, status, last_message_at);
      CREATE TABLE board_messages (
        message_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        thread_id TEXT NOT NULL REFERENCES board_threads(thread_id) ON DELETE CASCADE,
        project_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT NOT NULL,
        links TEXT NOT NULL,
        reply_to TEXT,
        created_at TEXT NOT NULL,
        superseded_by TEXT,
        edit_history TEXT NOT NULL,
        thread_title TEXT NOT NULL,
        UNIQUE(thread_id, seq),
        FOREIGN KEY(reply_to) REFERENCES board_messages(message_id)
      );
      CREATE INDEX board_messages_project_thread_seq_idx ON board_messages(project_id, thread_id, seq);
      CREATE VIRTUAL TABLE board_messages_fts USING fts5(
        body,
        thread_title,
        content='board_messages',
        content_rowid='rowid'
      );
      CREATE TRIGGER board_messages_fts_insert AFTER INSERT ON board_messages BEGIN
        INSERT INTO board_messages_fts(rowid, body, thread_title)
        VALUES (new.rowid, new.body, new.thread_title);
      END;
      CREATE TRIGGER board_messages_fts_delete AFTER DELETE ON board_messages BEGIN
        INSERT INTO board_messages_fts(board_messages_fts, rowid, body, thread_title)
        VALUES ('delete', old.rowid, old.body, old.thread_title);
      END;
      CREATE TRIGGER board_messages_fts_update AFTER UPDATE OF body, thread_title ON board_messages BEGIN
        INSERT INTO board_messages_fts(board_messages_fts, rowid, body, thread_title)
        VALUES ('delete', old.rowid, old.body, old.thread_title);
        INSERT INTO board_messages_fts(rowid, body, thread_title)
        VALUES (new.rowid, new.body, new.thread_title);
      END;
      CREATE TABLE board_decisions (
        decision_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        project_id TEXT NOT NULL,
        thread_id TEXT NOT NULL REFERENCES board_threads(thread_id) ON DELETE CASCADE,
        message_id TEXT NOT NULL UNIQUE REFERENCES board_messages(message_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        statement TEXT NOT NULL,
        rationale TEXT,
        made_by TEXT NOT NULL,
        bound_at TEXT NOT NULL,
        supersedes TEXT,
        sync_status TEXT NOT NULL,
        sync_attempts INTEGER NOT NULL,
        last_sync_error TEXT,
        synced_at TEXT,
        canon_record_path TEXT,
        canon_commit TEXT
      );
      CREATE INDEX board_decisions_project_status_idx ON board_decisions(project_id, sync_status);
      CREATE TABLE board_subscriptions (
        subscription_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        subscriber TEXT NOT NULL,
        filter TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX board_subscriptions_project_idx ON board_subscriptions(project_id);
      CREATE TABLE canon_sync_proposals (
        proposal_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL REFERENCES board_decisions(decision_id) ON DELETE CASCADE,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        before_content TEXT,
        after_content TEXT NOT NULL,
        diff TEXT NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT,
        commit_sha TEXT
      );
      CREATE INDEX canon_sync_proposals_decision_idx ON canon_sync_proposals(decision_id, created_at);
      CREATE TABLE board_maintenance_state (
        project_id TEXT PRIMARY KEY,
        last_audit_at TEXT,
        last_cleanup_at TEXT,
        next_audit_at TEXT,
        running_task_id TEXT
      );
    `,
  },
];
