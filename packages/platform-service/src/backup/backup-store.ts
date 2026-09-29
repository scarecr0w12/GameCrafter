import type {
  BackupDestination,
  BackupIdentity,
  BackupPlan,
  BackupRun,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';

interface JsonRow {
  value: string;
}

export class BackupStore {
  constructor(private readonly database: Database) {}

  identities(): BackupIdentity[] {
    return this.database
      .prepare(
        'SELECT identity_json AS value FROM backup_identities ORDER BY created_at, identity_id',
      )
      .all<JsonRow>()
      .map((row) => JSON.parse(row.value) as BackupIdentity);
  }

  identity(identityId: string): BackupIdentity | undefined {
    const row = this.database
      .prepare('SELECT identity_json AS value FROM backup_identities WHERE identity_id = ?')
      .get<JsonRow>(identityId);
    return row ? (JSON.parse(row.value) as BackupIdentity) : undefined;
  }

  saveIdentity(identity: BackupIdentity): void {
    this.database
      .prepare(
        `INSERT INTO backup_identities (identity_id, label, created_at, identity_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(identity_id) DO UPDATE SET
           label = excluded.label,
           identity_json = excluded.identity_json`,
      )
      .run(identity.identityId, identity.label, identity.createdAt, JSON.stringify(identity));
  }

  removeIdentity(identityId: string): void {
    this.database.prepare('DELETE FROM backup_identities WHERE identity_id = ?').run(identityId);
  }

  destinations(): BackupDestination[] {
    return this.database
      .prepare(
        'SELECT destination_json AS value FROM backup_destinations ORDER BY created_at, destination_id',
      )
      .all<JsonRow>()
      .map((row) => JSON.parse(row.value) as BackupDestination);
  }

  destination(destinationId: string): BackupDestination | undefined {
    const row = this.database
      .prepare('SELECT destination_json AS value FROM backup_destinations WHERE destination_id = ?')
      .get<JsonRow>(destinationId);
    return row ? (JSON.parse(row.value) as BackupDestination) : undefined;
  }

  saveDestination(destination: BackupDestination): void {
    this.database
      .prepare(
        `INSERT INTO backup_destinations
          (destination_id, kind, display_name, enabled, created_at, updated_at, destination_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(destination_id) DO UPDATE SET
           kind = excluded.kind,
           display_name = excluded.display_name,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at,
           destination_json = excluded.destination_json`,
      )
      .run(
        destination.destinationId,
        destination.kind,
        destination.displayName,
        Number(destination.enabled),
        destination.createdAt,
        destination.updatedAt,
        JSON.stringify(destination),
      );
  }

  removeDestination(destinationId: string): void {
    this.database
      .prepare('DELETE FROM backup_destinations WHERE destination_id = ?')
      .run(destinationId);
  }

  plans(projectId?: string): BackupPlan[] {
    const rows = projectId
      ? this.database
          .prepare(
            `SELECT plan_json AS value FROM backup_plans
             WHERE scope = 'profile' OR project_id = ? ORDER BY updated_at DESC`,
          )
          .all<JsonRow>(projectId)
      : this.database
          .prepare('SELECT plan_json AS value FROM backup_plans ORDER BY updated_at DESC')
          .all<JsonRow>();
    return rows.map((row) => JSON.parse(row.value) as BackupPlan);
  }

  plan(planId: string): BackupPlan | undefined {
    const row = this.database
      .prepare('SELECT plan_json AS value FROM backup_plans WHERE plan_id = ?')
      .get<JsonRow>(planId);
    return row ? (JSON.parse(row.value) as BackupPlan) : undefined;
  }

  savePlan(plan: BackupPlan): void {
    this.database
      .prepare(
        `INSERT INTO backup_plans
          (plan_id, scope, project_id, destination_id, identity_id, enabled, updated_at, plan_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(plan_id) DO UPDATE SET
           scope = excluded.scope,
           project_id = excluded.project_id,
           destination_id = excluded.destination_id,
           identity_id = excluded.identity_id,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at,
           plan_json = excluded.plan_json`,
      )
      .run(
        plan.planId,
        plan.scope,
        plan.projectId,
        plan.destinationId,
        plan.identityId,
        Number(plan.enabled),
        plan.updatedAt,
        JSON.stringify(plan),
      );
  }

  removePlan(planId: string): void {
    this.database.prepare('DELETE FROM backup_plans WHERE plan_id = ?').run(planId);
  }

  hasPlanForIdentity(identityId: string): boolean {
    return (
      this.database
        .prepare('SELECT 1 AS found FROM backup_plans WHERE identity_id = ? LIMIT 1')
        .get<{ found: number }>(identityId) !== undefined
    );
  }

  hasPlanForDestination(destinationId: string): boolean {
    return (
      this.database
        .prepare('SELECT 1 AS found FROM backup_plans WHERE destination_id = ? LIMIT 1')
        .get<{ found: number }>(destinationId) !== undefined
    );
  }

  runs(projectId?: string, limit = 100): BackupRun[] {
    const rows = projectId
      ? this.database
          .prepare(
            `SELECT run_json AS value FROM backup_runs
             WHERE project_id = ? ORDER BY started_at DESC LIMIT ?`,
          )
          .all<JsonRow>(projectId, limit)
      : this.database
          .prepare('SELECT run_json AS value FROM backup_runs ORDER BY started_at DESC LIMIT ?')
          .all<JsonRow>(limit);
    return rows.map((row) => JSON.parse(row.value) as BackupRun);
  }

  run(runId: string): BackupRun | undefined {
    const row = this.database
      .prepare('SELECT run_json AS value FROM backup_runs WHERE run_id = ?')
      .get<JsonRow>(runId);
    return row ? (JSON.parse(row.value) as BackupRun) : undefined;
  }

  matchingArchive(destinationId: string, archiveName: string): BackupRun | undefined {
    const row = this.database
      .prepare(
        `SELECT run_json AS value FROM backup_runs
         WHERE destination_id = ? AND json_extract(run_json, '$.archiveName') = ?
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get<JsonRow>(destinationId, archiveName);
    return row ? (JSON.parse(row.value) as BackupRun) : undefined;
  }

  saveRun(run: BackupRun): void {
    this.database
      .prepare(
        `INSERT INTO backup_runs
          (run_id, plan_id, scope, project_id, destination_id, status, started_at, run_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id) DO UPDATE SET
           status = excluded.status,
           run_json = excluded.run_json`,
      )
      .run(
        run.runId,
        run.planId,
        run.scope,
        run.projectId,
        run.destinationId,
        run.status,
        run.startedAt,
        JSON.stringify(run),
      );
  }
}
