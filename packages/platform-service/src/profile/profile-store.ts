import type { ProjectSummary } from '@gamecrafter/contracts';
import type { Database } from '../db/database';

export interface RegisteredProject {
  projectId: string;
  path: string;
  name: string;
  engineFamily: string;
  registeredAt: string;
  lastOpenedAt: string | null;
  trusted: boolean;
}

interface RegisteredProjectRow extends Omit<RegisteredProject, 'trusted'> {
  trusted: number;
}

export class ProfileStore {
  constructor(private readonly database: Database) {}

  register(summary: ProjectSummary): void {
    this.database
      .prepare(
        `INSERT INTO projects_registry
          (project_id, path, name, engine_family, registered_at, last_opened_at, trusted)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
          path = excluded.path,
          name = excluded.name,
          engine_family = excluded.engine_family,
          trusted = excluded.trusted`,
      )
      .run(
        summary.projectId,
        summary.path,
        summary.name,
        summary.engine.family,
        summary.createdAt,
        summary.lastOpenedAt,
        Number(summary.trusted),
      );
  }

  touchOpened(projectId: string, openedAt = new Date().toISOString()): void {
    this.database
      .prepare('UPDATE projects_registry SET last_opened_at = ? WHERE project_id = ?')
      .run(openedAt, projectId);
  }

  list(): RegisteredProject[] {
    return this.database
      .prepare(
        `SELECT project_id AS projectId, path, name, engine_family AS engineFamily,
          registered_at AS registeredAt, last_opened_at AS lastOpenedAt, trusted
         FROM projects_registry ORDER BY name`,
      )
      .all<RegisteredProjectRow>()
      .map(projectFromRow);
  }

  getById(projectId: string): RegisteredProject | undefined {
    const row = this.database
      .prepare(
        `SELECT project_id AS projectId, path, name, engine_family AS engineFamily,
          registered_at AS registeredAt, last_opened_at AS lastOpenedAt, trusted
         FROM projects_registry WHERE project_id = ?`,
      )
      .get<RegisteredProjectRow>(projectId);
    return row ? projectFromRow(row) : undefined;
  }

  getByPath(projectPath: string): RegisteredProject | undefined {
    const row = this.database
      .prepare(
        `SELECT project_id AS projectId, path, name, engine_family AS engineFamily,
          registered_at AS registeredAt, last_opened_at AS lastOpenedAt, trusted
         FROM projects_registry WHERE path = ?`,
      )
      .get<RegisteredProjectRow>(projectPath);
    return row ? projectFromRow(row) : undefined;
  }

  setTrusted(projectId: string, trusted: boolean): void {
    this.database
      .prepare('UPDATE projects_registry SET trusted = ? WHERE project_id = ?')
      .run(Number(trusted), projectId);
  }

  remove(projectId: string): void {
    this.database.prepare('DELETE FROM projects_registry WHERE project_id = ?').run(projectId);
  }
}

function projectFromRow(row: RegisteredProjectRow): RegisteredProject {
  return { ...row, trusted: row.trusted === 1 };
}
