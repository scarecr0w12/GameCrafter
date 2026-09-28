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
];
