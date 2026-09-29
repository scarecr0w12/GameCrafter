import type { Migration } from '../db/migrator';

export const profileMigrations: Migration[] = [
  {
    id: 1,
    name: 'create profile tables',
    up: `
      CREATE TABLE service_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE projects_registry (
        project_id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        engine_family TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        last_opened_at TEXT
      );
    `,
  },
  {
    id: 2,
    name: 'create platform settings table',
    up: `
      CREATE TABLE settings_values (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 3,
    name: 'create model registry and routing tables',
    up: `
      CREATE TABLE credentials (
        ref TEXT PRIMARY KEY,
        ciphertext BLOB NOT NULL,
        iv BLOB NOT NULL,
        tag BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE provider_accounts (
        account_id TEXT PRIMARY KEY,
        provider_kind TEXT NOT NULL,
        display_name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        credential_ref TEXT,
        has_credential INTEGER NOT NULL,
        headers TEXT NOT NULL,
        is_local INTEGER NOT NULL,
        privacy TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE models (
        model_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_model_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        pricing TEXT NOT NULL,
        metadata_source TEXT NOT NULL,
        metadata_updated_at TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        tags TEXT NOT NULL,
        work_types TEXT NOT NULL,
        roles TEXT NOT NULL
      );
      CREATE INDEX models_account_id_idx ON models(account_id);
      CREATE TABLE model_pools (
        pool_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scope TEXT NOT NULL,
        project_id TEXT,
        target TEXT,
        model_ids TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX model_pools_scope_project_idx ON model_pools(scope, project_id);
      CREATE TABLE route_decisions (
        decision_id TEXT PRIMARY KEY,
        decision TEXT NOT NULL,
        project_id TEXT,
        agent_role TEXT,
        task_type TEXT NOT NULL,
        engine TEXT,
        model_id TEXT NOT NULL,
        explored INTEGER NOT NULL,
        decided_at TEXT NOT NULL
      );
      CREATE INDEX route_decisions_context_idx ON route_decisions(project_id, task_type, decided_at);
      CREATE INDEX route_decisions_model_id_idx ON route_decisions(model_id);
      CREATE TABLE route_outcomes (
        decision_id TEXT PRIMARY KEY REFERENCES route_decisions(decision_id),
        success INTEGER NOT NULL,
        quality_score REAL,
        source TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        latency_ms INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        note TEXT,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE exploration_spend (
        day TEXT PRIMARY KEY,
        cost_usd REAL NOT NULL
      );
    `,
  },
  {
    id: 4,
    name: 'create skills registry and Project trust',
    up: `
      ALTER TABLE projects_registry ADD COLUMN trusted INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE installed_skills (
        name TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        resolved_ref TEXT,
        version TEXT,
        hash TEXT NOT NULL,
        previous_hash TEXT,
        license TEXT,
        compatibility TEXT,
        description TEXT NOT NULL,
        metadata TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 5,
    name: 'create MCP connection and usage tables',
    up: `
      CREATE TABLE mcp_connections (
        connection_id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL,
        project_id TEXT,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX mcp_connections_scope_project_idx ON mcp_connections(scope, project_id);
      CREATE TABLE mcp_usage (
        usage_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        task_id TEXT,
        decision_id TEXT,
        model_id TEXT,
        cost_usd REAL NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX mcp_usage_connection_time_idx ON mcp_usage(connection_id, recorded_at);
      CREATE TABLE mcp_tool_overrides (
        connection_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        side_effects TEXT,
        execution_mode TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (connection_id, tool_name)
      );
    `,
  },
];
