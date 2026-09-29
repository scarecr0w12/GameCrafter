import type { AssetJob, AssetPreview, AssetProviderAccount } from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ProjectDatabases } from '../projects/project-databases';

interface JsonRow {
  value: string;
}

export class AssetStore {
  constructor(
    private readonly profileDatabase: Database,
    private readonly projectDatabases: ProjectDatabases,
  ) {}

  accounts(): AssetProviderAccount[] {
    return this.profileDatabase
      .prepare(
        'SELECT account_json AS value FROM asset_provider_accounts ORDER BY provider_kind, account_id',
      )
      .all<JsonRow>()
      .map((row) => JSON.parse(row.value) as AssetProviderAccount);
  }

  account(accountId: string): AssetProviderAccount | undefined {
    const row = this.profileDatabase
      .prepare('SELECT account_json AS value FROM asset_provider_accounts WHERE account_id = ?')
      .get<JsonRow>(accountId);
    return row ? (JSON.parse(row.value) as AssetProviderAccount) : undefined;
  }

  saveAccount(account: AssetProviderAccount): void {
    this.profileDatabase
      .prepare(
        `INSERT INTO asset_provider_accounts (account_id, provider_kind, enabled, account_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           provider_kind = excluded.provider_kind,
           enabled = excluded.enabled,
           account_json = excluded.account_json`,
      )
      .run(
        account.accountId,
        account.providerKind,
        Number(account.enabled),
        JSON.stringify(account),
      );
  }

  removeAccount(accountId: string): void {
    this.profileDatabase
      .prepare('DELETE FROM asset_provider_accounts WHERE account_id = ?')
      .run(accountId);
  }

  job(projectId: string, jobId: string): AssetJob | undefined {
    const row = this.projectDatabases
      .get(projectId)
      .prepare('SELECT job_json AS value FROM asset_jobs WHERE project_id = ? AND job_id = ?')
      .get<JsonRow>(projectId, jobId);
    return row ? (JSON.parse(row.value) as AssetJob) : undefined;
  }

  jobs(projectId: string, limit = 100, status?: AssetJob['status']): AssetJob[] {
    const database = this.projectDatabases.get(projectId);
    const rows = status
      ? database
          .prepare(
            `SELECT job_json AS value FROM asset_jobs
             WHERE project_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?`,
          )
          .all<JsonRow>(projectId, status, limit)
      : database
          .prepare(
            `SELECT job_json AS value FROM asset_jobs
             WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
          )
          .all<JsonRow>(projectId, limit);
    return rows.map((row) => JSON.parse(row.value) as AssetJob);
  }

  allJobs(projectIds: string[]): AssetJob[] {
    return projectIds.flatMap((projectId) => {
      const database = this.projectDatabases.get(projectId);
      return database
        .prepare('SELECT job_json AS value FROM asset_jobs ORDER BY created_at')
        .all<JsonRow>()
        .map((row) => JSON.parse(row.value) as AssetJob);
    });
  }

  saveJob(job: AssetJob): void {
    this.projectDatabases
      .get(job.projectId)
      .prepare(
        `INSERT INTO asset_jobs (job_id, project_id, status, created_at, updated_at, job_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(job_id) DO UPDATE SET
           status = excluded.status,
           updated_at = excluded.updated_at,
           job_json = excluded.job_json`,
      )
      .run(job.jobId, job.projectId, job.status, job.createdAt, job.updatedAt, JSON.stringify(job));
  }

  preview(projectId: string, sourcePath: string): AssetPreview | undefined {
    const row = this.projectDatabases
      .get(projectId)
      .prepare('SELECT preview_json AS value FROM asset_previews WHERE source_path = ?')
      .get<JsonRow>(sourcePath);
    return row ? (JSON.parse(row.value) as AssetPreview) : undefined;
  }

  previews(projectId: string): AssetPreview[] {
    return this.projectDatabases
      .get(projectId)
      .prepare('SELECT preview_json AS value FROM asset_previews ORDER BY created_at ASC')
      .all<JsonRow>()
      .map((row) => JSON.parse(row.value) as AssetPreview);
  }

  savePreview(preview: AssetPreview): void {
    this.projectDatabases
      .get(preview.projectId)
      .prepare(
        `INSERT INTO asset_previews (source_path, source_sha256, preview_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source_path) DO UPDATE SET
           source_sha256 = excluded.source_sha256,
           preview_json = excluded.preview_json,
           created_at = excluded.created_at`,
      )
      .run(preview.sourcePath, preview.sourceSha256, JSON.stringify(preview), preview.createdAt);
  }

  removePreview(projectId: string, sourcePath: string): void {
    this.projectDatabases
      .get(projectId)
      .prepare('DELETE FROM asset_previews WHERE source_path = ?')
      .run(sourcePath);
  }
}
