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
];
