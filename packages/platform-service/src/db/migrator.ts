import type { Database } from './database';

export interface Migration {
  id: number;
  name: string;
  up: string;
}

export function currentMigrationVersion(db: Database): number {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get<{ name: string }>();
  if (!table) return 0;
  const row = db
    .prepare('SELECT COALESCE(MAX(id), 0) AS version FROM schema_migrations')
    .get<{ version: number }>();
  return Number(row?.version ?? 0);
}

export function latestMigrationVersion(migrations: Migration[]): number {
  return migrations.reduce((latest, migration) => Math.max(latest, migration.id), 0);
}

export function migrate(db: Database, migrations: Migration[]): { applied: number[] } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const applied: number[] = [];

  for (const migration of [...migrations].sort((left, right) => left.id - right.id)) {
    const existing = db
      .prepare('SELECT id, name FROM schema_migrations WHERE id = ?')
      .get<{ id: number; name: string }>(migration.id);
    if (existing) {
      if (existing.name !== migration.name) {
        throw new Error(
          `Migration ${migration.id} name mismatch: expected ${existing.name}, received ${migration.name}`,
        );
      }
      continue;
    }

    db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString(),
      );
    });
    applied.push(migration.id);
  }

  return { applied };
}
