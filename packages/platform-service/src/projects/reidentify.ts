import { TaskStore } from '../tasks/task-store';
import { isTerminal } from '@gamecrafter/contracts';
import type { Database } from '../db/database';

/** Rebind copied operational state without modifying authored text or historical source IDs. */
export function reidentifyProjectDatabase(
  database: Database,
  previousId: string,
  nextId: string,
  now: () => Date = () => new Date(),
): void {
  database.transaction(() => {
    database
      .prepare('UPDATE project_meta SET value = ? WHERE key = ? AND value = ?')
      .run(nextId, 'project_id', previousId);
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all<{ name: string }>();
    for (const { name } of tables) {
      const table = quote(name);
      const columns = database.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      if (columns.some((column) => column.name === 'project_id')) {
        database
          .prepare(`UPDATE ${table} SET project_id = ? WHERE project_id = ?`)
          .run(nextId, previousId);
      }
      for (const { name: column } of columns) {
        if (
          !column.endsWith('_json') &&
          !['payload', 'input', 'checkpoint', 'result', 'output', 'integration_json'].includes(
            column,
          )
        )
          continue;
        const field = quote(column);
        // json_tree finds nested ownership fields while leaving prose and provenance untouched.
        const rows = database
          .prepare(
            `SELECT rowid AS id, ${field} AS value FROM ${table} WHERE json_valid(${field}) AND EXISTS (SELECT 1 FROM json_tree(${field}) WHERE key = 'projectId' AND value = ?)`,
          )
          .all<{ id: number; value: string }>(previousId);
        for (const row of rows) {
          database
            .prepare(`UPDATE ${table} SET ${field} = ? WHERE rowid = ?`)
            .run(JSON.stringify(rebind(JSON.parse(row.value), previousId, nextId)), row.id);
        }
      }
    }
    // Connection state and derived indexes belong to the source namespace and must be rebuilt.
    for (const table of [
      'engine_capability_reports',
      'engine_live_bridges',
      'dcc_capability_reports',
      'resource_locks',
      'asset_previews',
      'knowledge_vectors',
      'knowledge_index_state',
      'knowledge_index_meta',
      'knowledge_chunks',
      'canon_references',
      'canon_records',
      'knowledge_conflicts',
      'change_edges',
      'change_nodes',
    ]) {
      database.exec(`DELETE FROM ${quote(table)}`);
    }
  });
  const taskStore = new TaskStore(database, now);
  for (const task of taskStore.list({ limit: Number.MAX_SAFE_INTEGER })) {
    if (!isTerminal(task.state))
      taskStore.transition(
        task.taskId,
        'cancelled',
        'Project copied to a new identity; active work belongs to the source Project',
        'service',
        { lease: null, finishedAt: now().toISOString() },
      );
  }
  // A copied approval cannot authorize work in a newly identified Project.
  database
    .prepare(
      'UPDATE approvals SET resolved_at = ?, approved = 0, reason = ? WHERE resolved_at IS NULL',
    )
    .run(
      now().toISOString(),
      'Project copied to a new identity; approval belongs to the source Project',
    );
  database.exec('DELETE FROM board_maintenance_state');
  database
    .prepare(
      `UPDATE asset_jobs SET status = 'cancelled', updated_at = ?, job_json = json_set(job_json, '$.status', 'cancelled', '$.updatedAt', ?, '$.error', 'Project copied to a new identity; active generation belongs to the source Project') WHERE status IN ('queued', 'submitted', 'running', 'downloading')`,
    )
    .run(now().toISOString(), now().toISOString());
  database
    .prepare(
      `UPDATE integrations SET status = 'aborted', updated_at = ?, integration_json = json_set(integration_json, '$.status', 'aborted', '$.updatedAt', ?) WHERE status IN ('pending', 'validating', 'ready', 'integrating', 'conflict')`,
    )
    .run(now().toISOString(), now().toISOString());
}

function rebind(value: unknown, previousId: string, nextId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rebind(item, previousId, nextId));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'restoredFrom'
        ? item
        : key === 'projectId' && item === previousId
          ? nextId
          : rebind(item, previousId, nextId),
    ]),
  );
}

function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
