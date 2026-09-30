import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from './migrations';

describe('profile migrations', () => {
  it('creates MCP, plugin, engine, asset, backup, and DCC persistence tables', () => {
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all<{ name: string }>()
        .map((row) => row.name);
      expect(tables).toContain('mcp_connections');
      expect(tables).toContain('mcp_tool_overrides');
      expect(tables).toContain('mcp_usage');
      expect(tables).toContain('installed_plugins');
      expect(tables).toContain('plugin_project_enablement');
      expect(tables).toContain('plugin_usage');
      expect(tables).toContain('plugin_host_calls');
      expect(tables).toContain('engine_installations');
      expect(tables).toContain('asset_provider_accounts');
      expect(tables).toContain('backup_identities');
      expect(tables).toContain('backup_destinations');
      expect(tables).toContain('backup_plans');
      expect(tables).toContain('backup_runs');
      expect(tables).toContain('dcc_installations');
      expect(tables).toContain('update_states');
      expect(database.prepare('SELECT id FROM schema_migrations').all()).toHaveLength(11);
    } finally {
      database.close();
    }
  });
});
