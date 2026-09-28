import type { ProjectSummary } from '@gamecrafter/contracts';
import type { Database } from '../db/database';

export interface RegisteredProject {
  projectId: string;
  path: string;
  name: string;
  engineFamily: string;
  registeredAt: string;
  lastOpenedAt: string | null;
}

export class ProfileStore {
  constructor(private readonly database: Database) {}

  register(summary: ProjectSummary): void {
    this.database
      .prepare(
        `INSERT INTO projects_registry
          (project_id, path, name, engine_family, registered_at, last_opened_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
          path = excluded.path,
          name = excluded.name,
          engine_family = excluded.engine_family`,
      )
      .run(
        summary.projectId,
        summary.path,
        summary.name,
        summary.engine.family,
        summary.createdAt,
        summary.lastOpenedAt,
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
          registered_at AS registeredAt, last_opened_at AS lastOpenedAt
         FROM projects_registry ORDER BY name`,
      )
      .all<RegisteredProject>();
  }

  getById(projectId: string): RegisteredProject | undefined {
    return this.database
      .prepare(
        `SELECT project_id AS projectId, path, name, engine_family AS engineFamily,
          registered_at AS registeredAt, last_opened_at AS lastOpenedAt
         FROM projects_registry WHERE project_id = ?`,
      )
      .get<RegisteredProject>(projectId);
  }

  getByPath(projectPath: string): RegisteredProject | undefined {
    return this.database
      .prepare(
        `SELECT project_id AS projectId, path, name, engine_family AS engineFamily,
          registered_at AS registeredAt, last_opened_at AS lastOpenedAt
         FROM projects_registry WHERE path = ?`,
      )
      .get<RegisteredProject>(projectPath);
  }

  remove(projectId: string): void {
    this.database.prepare('DELETE FROM projects_registry WHERE project_id = ?').run(projectId);
  }
}
