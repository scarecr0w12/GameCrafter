import type { Database } from '../db/database';

export interface UpdateDismissalStore {
  list(): string[];
  add(version: string): void;
}

const DISMISSAL_CHANNEL = 'stable:dismissed';

export class SqliteUpdateDismissalStore implements UpdateDismissalStore {
  constructor(private readonly database: Database) {}

  list(): string[] {
    const row = this.database
      .prepare('SELECT state_json AS stateJson FROM update_states WHERE channel = ?')
      .get<{ stateJson: string }>(DISMISSAL_CHANNEL);
    if (!row) return [];
    try {
      const parsed: unknown = JSON.parse(row.stateJson);
      if (typeof parsed !== 'object' || parsed === null) return [];
      const versions = (parsed as { versions?: unknown }).versions;
      if (!Array.isArray(versions)) return [];
      return versions.filter((version): version is string => typeof version === 'string');
    } catch {
      return [];
    }
  }

  add(version: string): void {
    const versions = [...new Set([...this.list(), version])].sort();
    this.database
      .prepare(
        `INSERT INTO update_states (channel, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(channel) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at`,
      )
      .run(
        DISMISSAL_CHANNEL,
        JSON.stringify({ schemaVersion: 1, versions }),
        new Date().toISOString(),
      );
  }
}
