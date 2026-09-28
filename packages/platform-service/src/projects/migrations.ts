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
];
