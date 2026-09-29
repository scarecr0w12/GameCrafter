import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from './migrations';

describe('profile migrations', () => {
  it('creates MCP, plugin, and engine persistence tables', () => {
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
      expect(database.prepare('SELECT id FROM schema_migrations').all()).toHaveLength(7);
    } finally {
      database.close();
    }
  });
});
