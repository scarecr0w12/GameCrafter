import { reidentifyProjectDatabase } from '../projects/reidentify';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BackupArchiveEntry,
  BackupDestinationConfigSchema,
  BackupDestinationSchema,
  BackupIdentitySchema,
  BackupManifestSchema,
  BackupPlanSchema,
  BackupRunSchema,
  RpcError,
  RpcErrorCode,
  compile,
  uuidv7,
  type BackupDestination,
  type BackupDestinationConfig,
  type BackupDestinationKind,
  type BackupIdentity,
  type BackupManifest,
  type BackupPlan,
  type BackupRestoreResult,
  type BackupRun,
  type BackupScope,
  type BackupVerifyResult,
  type RpcParams,
} from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { profileMigrations } from '../profile/migrations';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { ProjectWorkspace } from '../projects/workspace';
import type { SettingsService } from '../settings/settings-service';
import { projectMigrations } from '../projects/migrations';
import { BackupStore } from './backup-store';
import { createArchiveWriter } from './archive/writer';
import { readArchive, readArchiveWithKey } from './archive/reader';
import type { BackupArchiveWriter } from './archive/writer';
import type { BackupArchiveWriteEntry } from './archive/types';
import { createBackupIdentityCrypto } from './archive/crypto';
import { BackupDestinationRegistry } from './destinations/registry';
import type { BackupDestinationAdapter } from './destinations/destination';
import { createBackupSnapshot, hashFile } from './snapshot';
import { BackupScheduler, nextBackupTime } from './scheduler';
import {
  extractBackupToDirectory,
  ensureRestoreTargetIsEmpty,
  removeRestoreStaging,
  restoreStagingPath,
} from './restore';
import {
  ProjectManifestSchema,
  PROJECT_MANIFEST_FILENAME,
  type ProjectManifest,
} from '@gamecrafter/contracts';

const destinationConfigValidator = compile<BackupDestinationConfig>(BackupDestinationConfigSchema);
const identityValidator = compile<BackupIdentity>(BackupIdentitySchema);
const destinationValidator = compile<BackupDestination>(BackupDestinationSchema);
const planValidator = compile<BackupPlan>(BackupPlanSchema);
const runValidator = compile<BackupRun>(BackupRunSchema);
const manifestValidator = compile<BackupManifest>(BackupManifestSchema);
const projectManifestValidator = compile<ProjectManifest>(ProjectManifestSchema);

type RunRequest = RpcParams<'backup/run'>;
type RunContext = {
  controller: AbortController;
  promise: Promise<void>;
  planId: string | null;
};

export interface BackupServiceOptions {
  database: Database;
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  workspace: ProjectWorkspace;
  credentials: CredentialStore;
  settings: SettingsService;
  profileDir: string;
  platformVersion: string;
  pluginVersions(): Record<string, string>;
  events: { runChanged(run: BackupRun): void };
  now?: () => Date;
  destinationRegistry?: BackupDestinationRegistry;
}

export class BackupService {
  readonly store: BackupStore;
  readonly destinations: BackupDestinationRegistry;
  private readonly now: () => Date;
  private readonly activeRuns = new Map<string, RunContext>();
  private readonly scheduler: BackupScheduler;
  private stopped = false;

  constructor(private readonly options: BackupServiceOptions) {
    this.store = new BackupStore(options.database);
    this.destinations = options.destinationRegistry ?? new BackupDestinationRegistry();
    this.now = options.now ?? (() => new Date());
    this.scheduler = new BackupScheduler({
      plans: () => this.store.plans(),
      savePlan: (plan) => this.store.savePlan(plan),
      isPlanActive: (planId) => [...this.activeRuns.values()].some((run) => run.planId === planId),
      runPlan: async (planId) => this.startPlanRun(planId, 'schedule'),
      now: this.now,
    });
  }

  identities(): BackupIdentity[] {
    return this.store.identities().map((identity) => identityValidator.assert(identity));
  }

  async createIdentity(input: RpcParams<'backup/identity/create'>): Promise<BackupIdentity> {
    if (input.secret.length < 12) {
      throw new RpcError(
        'Backup recovery secrets must be at least 12 characters.',
        RpcErrorCode.InvalidParams,
      );
    }
    const identityId = uuidv7();
    const logN = this.settingNumber('backup.scryptLogN', undefined, 15);
    const crypto = await createBackupIdentityCrypto(identityId, input.secret, logN);
    const identity = identityValidator.assert({
      schemaVersion: 1,
      identityId,
      label: input.label,
      ...crypto,
      createdAt: this.now().toISOString(),
    });
    this.store.saveIdentity(identity);
    return identity;
  }

  removeIdentity(identityId: string): void {
    if (!this.store.identity(identityId)) {
      throw new RpcError('Backup identity not found.', RpcErrorCode.BackupIdentityNotFound);
    }
    if (this.store.hasPlanForIdentity(identityId)) {
      throw new RpcError('Backup identity is referenced by a plan.', RpcErrorCode.InvalidParams);
    }
    if (
      [...this.activeRuns.keys()].some((runId) => this.store.run(runId)?.identityId === identityId)
    ) {
      throw new RpcError('Backup identity is used by an active run.', RpcErrorCode.InvalidParams);
    }
    this.store.removeIdentity(identityId);
  }

  destinationsList(): BackupDestination[] {
    return this.store.destinations().map((destination) => destinationValidator.assert(destination));
  }

  addDestination(input: RpcParams<'backup/addDestination'>): BackupDestination {
    const destinationId = uuidv7();
    this.validateDestinationConfig(input.kind, input.config);
    this.storeSecrets(destinationId, input.kind, input.secrets ?? {});
    const now = this.now().toISOString();
    const destination = destinationValidator.assert({
      schemaVersion: 1,
      destinationId,
      kind: input.kind,
      displayName: input.displayName,
      config: input.config,
      hasSecrets: this.hasRequiredSecrets(destinationId, input.kind),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    this.store.saveDestination(destination);
    return destination;
  }

  updateDestination(input: RpcParams<'backup/updateDestination'>): BackupDestination {
    const current = this.requireDestination(input.destinationId);
    if (input.patch.config) this.validateDestinationConfig(current.kind, input.patch.config);
    if (input.patch.secrets)
      this.storeSecrets(current.destinationId, current.kind, input.patch.secrets);
    const safePatch = { ...input.patch };
    delete safePatch.secrets;
    const updated = destinationValidator.assert({
      ...current,
      ...safePatch,
      config: input.patch.config ?? current.config,
      hasSecrets: this.hasRequiredSecrets(current.destinationId, current.kind),
      updatedAt: this.now().toISOString(),
    });
    this.store.saveDestination(updated);
    return updated;
  }

  removeDestination(destinationId: string): void {
    this.requireDestination(destinationId);
    if (this.store.hasPlanForDestination(destinationId)) {
      throw new RpcError('Backup destination is referenced by a plan.', RpcErrorCode.InvalidParams);
    }
    if (
      [...this.activeRuns.keys()].some(
        (runId) => this.store.run(runId)?.destinationId === destinationId,
      )
    ) {
      throw new RpcError(
        'Backup destination is used by an active run.',
        RpcErrorCode.InvalidParams,
      );
    }
    this.options.credentials.deletePrefix(`backup-destination/${destinationId}/`);
    this.store.removeDestination(destinationId);
  }

  async testDestination(
    destinationId: string,
  ): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const destination = this.requireDestination(destinationId);
    const adapter = this.createDestinationAdapter(destination);
    const started = Date.now();
    try {
      await adapter.probe();
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: redact(error, this.destinationSecrets(destination)),
      };
    }
  }

  plans(projectId?: string): BackupPlan[] {
    return this.store.plans(projectId).map((plan) => planValidator.assert(plan));
  }

  savePlan(input: RpcParams<'backup/savePlan'>): BackupPlan {
    const previous = input.planId ? this.store.plan(input.planId) : undefined;
    if (input.planId && !previous)
      throw new RpcError('Backup plan not found.', RpcErrorCode.BackupPlanNotFound);
    this.validatePlanScope(input.plan.scope, input.plan.projectId);
    this.requireDestination(input.plan.destinationId);
    this.requireIdentity(input.plan.identityId);
    if (input.plan.scope === 'project') this.options.workspace.get(input.plan.projectId!);
    const now = this.now().toISOString();
    const plan = planValidator.assert({
      schemaVersion: 1,
      planId: previous?.planId ?? uuidv7(),
      ...input.plan,
      lastRunAt: previous?.lastRunAt ?? null,
      nextRunAt: input.plan.enabled
        ? nextBackupTime(input.plan.schedule, previous?.lastRunAt ?? null, this.now())
        : null,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });
    this.store.savePlan(plan);
    this.scheduler.wake();
    return plan;
  }

  removePlan(planId: string): void {
    if (!this.store.plan(planId))
      throw new RpcError('Backup plan not found.', RpcErrorCode.BackupPlanNotFound);
    if ([...this.activeRuns.values()].some((run) => run.planId === planId)) {
      throw new RpcError('Cannot remove an active backup plan.', RpcErrorCode.InvalidParams);
    }
    this.store.removePlan(planId);
    this.scheduler.wake();
  }

  async run(input: RunRequest): Promise<BackupRun> {
    if ('planId' in input) return this.startPlanRun(input.planId, 'manual');
    const projectId = input.scope === 'project' ? (input.projectId ?? null) : null;
    this.validatePlanScope(input.scope, projectId);
    return this.beginRun({
      planId: null,
      scope: input.scope,
      projectId,
      destinationId: input.destinationId,
      identityId: input.identityId,
      trigger: 'manual',
    });
  }

  runs(projectId?: string, limit = 100): BackupRun[] {
    return this.store
      .runs(projectId, Math.max(1, Math.min(1000, limit)))
      .map((run) => runValidator.assert(run));
  }

  runById(runId: string): BackupRun {
    const run = this.store.run(runId);
    if (!run) throw new RpcError('Backup run not found.', RpcErrorCode.BackupRunNotFound);
    return runValidator.assert(run);
  }

  async cancel(runId: string): Promise<BackupRun> {
    const active = this.activeRuns.get(runId);
    if (!active) return this.runById(runId);
    active.controller.abort(new Error('Cancelled by user'));
    await active.promise;
    return this.runById(runId);
  }

  async archives(destinationId: string): Promise<BackupArchiveEntry[]> {
    const destination = this.requireDestination(destinationId);
    try {
      return await this.createDestinationAdapter(destination).list();
    } catch (error) {
      throw new RpcError(
        `Could not list backup archives: ${redact(error, this.destinationSecrets(destination))}`,
        RpcErrorCode.BackupDestinationFailed,
      );
    }
  }

  async inspect(input: RpcParams<'backup/inspect'>): Promise<BackupManifest> {
    const destination = this.requireDestination(input.destinationId);
    await this.requireArchive(destination, input.archiveName);
    const adapter = this.createDestinationAdapter(destination);
    try {
      const stream = await adapter.get(input.archiveName);
      const result = await readArchive(stream, input.secret, { manifestOnly: true });
      return manifestValidator.assert(result.manifest);
    } catch (error) {
      throw mapArchiveError(error, this.destinationSecrets(destination));
    }
  }

  async verify(input: RpcParams<'backup/verify'>): Promise<BackupVerifyResult> {
    const destination = this.requireDestination(input.destinationId);
    await this.requireArchive(destination, input.archiveName);
    const adapter = this.createDestinationAdapter(destination);
    mkdirSync(this.stagingDirectory(), { recursive: true, mode: 0o700 });
    const verifyDirectory = await mkdtemp(path.join(this.stagingDirectory(), 'verify-'));
    const archivePath = path.join(verifyDirectory, input.archiveName);
    const restorePath = path.join(verifyDirectory, 'restore');
    let bytes = 0;
    let digest = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
    try {
      const stream = await adapter.get(input.archiveName);
      const hash = createHash('sha256');
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(stream, counter, createWriteStream(archivePath, { flags: 'wx', mode: 0o600 }));
      digest = hash.digest('hex');
      const extracted = await extractBackupToDirectory({
        source: createReadStream(archivePath),
        secret: input.secret,
        targetPath: restorePath,
      });
      const result: BackupVerifyResult = {
        ok: true,
        archiveName: input.archiveName,
        bytes,
        sha256: digest,
        files: extracted.manifest.entries.filter((entry) => entry.kind === 'file').length,
        warnings: extracted.warnings,
        error: null,
      };
      const run = this.store.matchingArchive(destination.destinationId, input.archiveName);
      if (run) this.updateRun({ ...run, drilledAt: this.now().toISOString() });
      return result;
    } catch (error) {
      return {
        ok: false,
        archiveName: input.archiveName,
        bytes,
        sha256: digest,
        files: 0,
        warnings: [],
        error: redact(error, { ...this.destinationSecrets(destination), secret: input.secret }),
      };
    } finally {
      rmSync(verifyDirectory, { recursive: true, force: true });
    }
  }

  async restore(input: RpcParams<'backup/restore'>): Promise<BackupRestoreResult> {
    const destination = this.requireDestination(input.destinationId);
    await this.requireArchive(destination, input.archiveName);
    const targetPath = ensureRestoreTargetIsEmpty(input.targetPath);
    const tempPath = restoreStagingPath(targetPath, uuidv7().replaceAll('-', '').slice(0, 8));
    mkdirSync(path.dirname(tempPath), { recursive: true });
    try {
      const adapter = this.createDestinationAdapter(destination);
      const source = await adapter.get(input.archiveName);
      const extracted = await extractBackupToDirectory({
        source,
        secret: input.secret,
        targetPath: tempPath,
      });
      const manifest = extracted.manifest;
      const warnings = [...extracted.warnings];
      const installedPlugins = this.options.pluginVersions();
      for (const [pluginId, version] of Object.entries(manifest.pluginVersions)) {
        if (installedPlugins[pluginId] !== version) {
          warnings.push(
            `Plugin ${pluginId} version ${version} is not installed at the same version.`,
          );
        }
      }
      if (manifest.scope === 'project') {
        if (input.register) {
          this.prepareRestoredProject(tempPath, manifest, warnings);
          if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
          renameSync(tempPath, targetPath);
          const opened = this.options.workspace.open(targetPath);
          return {
            targetPath,
            scope: 'project',
            projectId: manifest.projectId,
            registeredProjectId: opened.projectId,
            manifest,
            warnings,
          };
        }
        if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
        renameSync(tempPath, targetPath);
        return {
          targetPath,
          scope: 'project',
          projectId: manifest.projectId,
          registeredProjectId: null,
          manifest,
          warnings,
        };
      }
      if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
      renameSync(tempPath, targetPath);
      warnings.push(
        `To activate this restored profile, set GAMECRAFTER_PROFILE_DIR=${targetPath} before starting the service (for example: GAMECRAFTER_PROFILE_DIR=${targetPath} gamecrafter-service start).`,
      );
      return {
        targetPath,
        scope: 'profile',
        projectId: null,
        registeredProjectId: null,
        manifest,
        warnings,
      };
    } catch (error) {
      removeRestoreStaging(tempPath);
      throw mapRestoreError(error, this.destinationSecrets(destination), input.secret);
    }
  }

  onSettingChanged(key: string): void {
    if (key.startsWith('backup.')) this.scheduler.wake();
  }

  async start(): Promise<void> {
    if (this.stopped) return;
    const stagingDirectory = this.stagingDirectory();
    if (existsSync(stagingDirectory)) {
      for (const name of readdirSync(stagingDirectory)) {
        if (name.startsWith('run-') || name.startsWith('verify-')) {
          rmSync(path.join(stagingDirectory, name), { recursive: true, force: true });
        }
      }
    }
    for (const run of this.store.runs(undefined, 1000)) {
      if (run.status === 'running' || run.status === 'uploading' || run.status === 'verifying') {
        this.updateRun({
          ...run,
          status: 'failed',
          finishedAt: this.now().toISOString(),
          error: 'Service stopped before the backup finished.',
        });
      }
    }
    this.scheduler.start();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.scheduler.stop();
    const active = [...this.activeRuns.values()];
    for (const item of active) item.controller.abort(new Error('Service stopped'));
    await Promise.all(active.map((item) => item.promise));
  }

  private async startPlanRun(planId: string, trigger: 'manual' | 'schedule'): Promise<BackupRun> {
    const plan = this.store.plan(planId);
    if (!plan) throw new RpcError('Backup plan not found.', RpcErrorCode.BackupPlanNotFound);
    if (!plan.enabled && trigger === 'schedule') {
      throw new RpcError('Backup plan is disabled.', RpcErrorCode.InvalidParams);
    }
    return this.beginRun({
      planId: plan.planId,
      scope: plan.scope,
      projectId: plan.projectId,
      destinationId: plan.destinationId,
      identityId: plan.identityId,
      trigger,
    });
  }

  private beginRun(input: {
    planId: string | null;
    scope: BackupScope;
    projectId: string | null;
    destinationId: string;
    identityId: string;
    trigger: 'manual' | 'schedule';
  }): BackupRun {
    if (this.stopped)
      throw new RpcError('Backup service is stopped.', RpcErrorCode.BackupDestinationFailed);
    if (input.planId && [...this.activeRuns.values()].some((run) => run.planId === input.planId)) {
      throw new RpcError('A backup for this plan is already running.', RpcErrorCode.InvalidParams);
    }
    const identity = this.requireIdentity(input.identityId);
    const destination = this.requireDestination(input.destinationId);
    if (!destination.enabled) {
      throw new RpcError('Backup destination is disabled.', RpcErrorCode.BackupDestinationFailed);
    }
    if (!destination.hasSecrets && destination.kind !== 'local') {
      throw new RpcError(
        'Backup destination credentials are incomplete.',
        RpcErrorCode.BackupDestinationFailed,
      );
    }
    if (input.scope === 'project') this.options.workspace.get(input.projectId!);
    const now = this.now().toISOString();
    const archiveId = uuidv7();
    const archiveName = makeArchiveName(input.scope, input.projectId, now, archiveId);
    const run = runValidator.assert({
      schemaVersion: 1,
      runId: uuidv7(),
      planId: input.planId,
      scope: input.scope,
      projectId: input.scope === 'project' ? input.projectId : null,
      destinationId: destination.destinationId,
      identityId: identity.identityId,
      archiveId,
      archiveName,
      status: 'running',
      bytes: 0,
      sha256: null,
      files: 0,
      startedAt: now,
      finishedAt: null,
      verifiedAt: null,
      drilledAt: null,
      prunedAt: null,
      error: null,
      trigger: input.trigger,
    });
    const controller = new AbortController();
    this.store.saveRun(run);
    this.emit(run);
    const promise = Promise.resolve()
      .then(() => this.processRun(run, identity, destination, controller.signal))
      .catch((error: unknown) => {
        const current = this.store.run(run.runId);
        if (
          !current ||
          current.status === 'verified' ||
          current.status === 'failed' ||
          current.status === 'cancelled'
        )
          return;
        const cancelled = controller.signal.aborted;
        this.updateRun({
          ...current,
          status: cancelled ? 'cancelled' : 'failed',
          finishedAt: this.now().toISOString(),
          error: cancelled
            ? 'Backup cancelled.'
            : redact(error, this.destinationSecrets(destination)),
        });
      })
      .finally(() => {
        this.activeRuns.delete(run.runId);
        this.scheduler.wake();
      });
    this.activeRuns.set(run.runId, { controller, promise, planId: input.planId });
    return run;
  }

  private async processRun(
    initial: BackupRun,
    identity: BackupIdentity,
    destination: BackupDestination,
    signal: AbortSignal,
  ): Promise<void> {
    const stagingDirectory = this.stagingDirectory();
    mkdirSync(stagingDirectory, { recursive: true, mode: 0o700 });
    const runDirectory = await mkdtemp(path.join(stagingDirectory, `run-${initial.runId}-`));
    const archivePath = path.join(runDirectory, initial.archiveName);
    const verifyPath = path.join(runDirectory, 'remote-verify.gcbackup');
    let archiveKey: Buffer | undefined;
    let current = initial;
    let manifest: BackupManifest | undefined;
    try {
      const project =
        initial.scope === 'project' ? this.options.workspace.get(initial.projectId!) : undefined;
      const sourcePath = project?.path ?? this.options.profileDir;
      const snapshotDatabase =
        initial.scope === 'project'
          ? this.options.projectDatabases.get(initial.projectId!)
          : this.options.database;
      const snapshot = await createBackupSnapshot({
        archiveId: initial.archiveId,
        scope: initial.scope,
        projectId: initial.projectId,
        sourcePath,
        snapshotPath: path.join(runDirectory, 'snapshot'),
        databaseSnapshotPath:
          initial.scope === 'project' ? '.gamecrafter/project.sqlite' : 'profile.sqlite',
        snapshotDatabase: (destinationPath) => snapshotDatabase.snapshotTo(destinationPath),
        createdAt: initial.startedAt,
        platformVersion: this.options.platformVersion,
        profileSchemaVersion: currentMigrationVersion(profileMigrations),
        projectSchemaVersion: currentMigrationVersion(projectMigrations),
        pluginVersions: this.options.pluginVersions(),
        excludeGlobs: this.settingValue<string[]>(
          'backup.excludeGlobs',
          initial.projectId ?? undefined,
          [],
        ),
        includeAssetJobs: this.settingValue<boolean>(
          'backup.includeAssetJobs',
          initial.projectId ?? undefined,
          true,
        ),
      });
      manifest = manifestValidator.assert(snapshot.manifest);
      const writer: BackupArchiveWriter = createArchiveWriter(
        createWriteStream(archivePath, { flags: 'wx', mode: 0o600 }),
        {
          identity,
          manifest,
          compressionLevel: this.settingNumber('backup.compressionLevel', undefined, 6),
        },
      );
      archiveKey = writer.archiveKey;
      let processedBytes = 0;
      let processedFiles = 0;
      let lastBroadcastBytes = 0;
      let lastBroadcastFiles = 0;
      const progressEntries = async function* (
        service: BackupService,
      ): AsyncGenerator<BackupArchiveWriteEntry> {
        for (const entry of snapshot.entries) {
          yield entry;
          if (entry.kind === 'file') {
            processedFiles += 1;
            processedBytes += entry.bytes;
            if (
              processedBytes - lastBroadcastBytes >= 2 * 1024 * 1024 ||
              processedFiles - lastBroadcastFiles >= 50
            ) {
              lastBroadcastBytes = processedBytes;
              lastBroadcastFiles = processedFiles;
              current = { ...current, files: processedFiles };
              service.updateRun(current);
            }
          }
        }
      };
      await pipeline(Readable.from(progressEntries(this)), writer, { signal });
      if (signal.aborted) throw signal.reason;
      const archiveStat = statSync(archivePath);
      const maxArchiveMb = this.settingNumber('backup.maxArchiveMb', undefined, 0);
      if (maxArchiveMb > 0 && archiveStat.size > maxArchiveMb * 1024 * 1024) {
        throw new Error('Backup archive exceeds backup.maxArchiveMb.');
      }
      const sha256 = await hashFile(archivePath);
      current = {
        ...current,
        bytes: archiveStat.size,
        sha256,
        files: manifest.entries.filter((entry) => entry.kind === 'file').length,
      };
      this.updateRun(current);

      const adapter = this.createDestinationAdapter(destination);
      current = { ...current, status: 'uploading' };
      this.updateRun(current);
      let uploadReportBytes = 0;
      await adapter.put(
        initial.archiveName,
        archivePath,
        (bytes) => {
          if (bytes - uploadReportBytes >= 2 * 1024 * 1024 || bytes === archiveStat.size) {
            uploadReportBytes = bytes;
            current = { ...current, bytes: archiveStat.size };
            this.updateRun(current);
          }
        },
        signal,
      );
      if (signal.aborted) throw signal.reason;

      current = { ...current, status: 'verifying' };
      this.updateRun(current);
      const remoteStream = await adapter.get(initial.archiveName, signal);
      const remoteHash = createHash('sha256');
      let remoteBytes = 0;
      const hashTransform = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          remoteBytes += chunk.length;
          remoteHash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        remoteStream,
        hashTransform,
        createWriteStream(verifyPath, { flags: 'wx', mode: 0o600 }),
        { signal },
      );
      const verifiedHash = remoteHash.digest('hex');
      if (remoteBytes !== archiveStat.size || verifiedHash !== sha256) {
        throw new Error('Uploaded backup failed destination hash verification.');
      }
      const drillAfterBackup = this.settingValue<boolean>(
        'backup.drillAfterBackup',
        undefined,
        true,
      );
      let drilledAt: string | null = null;
      if (drillAfterBackup) {
        await verifyArchiveWithKey(verifyPath, archiveKey!, manifest);
        drilledAt = this.now().toISOString();
      }
      if (signal.aborted) throw signal.reason;
      const finishedAt = this.now().toISOString();
      current = {
        ...current,
        status: 'verified',
        verifiedAt: finishedAt,
        drilledAt,
        finishedAt,
        error: null,
      };
      this.updateRun(current);
      if (current.planId) this.finishPlan(current.planId, finishedAt);
      await this.applyRetention(current);
    } catch (error) {
      const cancelled = signal.aborted;
      const finishedAt = this.now().toISOString();
      current = {
        ...current,
        status: cancelled ? 'cancelled' : 'failed',
        finishedAt,
        error: cancelled
          ? 'Backup cancelled.'
          : redact(error, this.destinationSecrets(destination)),
      };
      this.updateRun(current);
      if (current.planId) this.finishPlan(current.planId, finishedAt);
    } finally {
      archiveKey?.fill(0);
      rmSync(runDirectory, { recursive: true, force: true });
    }
  }

  private async applyRetention(current: BackupRun): Promise<void> {
    if (!current.planId) return;
    const plan = this.store.plan(current.planId);
    if (!plan) return;
    const destination = this.requireDestination(plan.destinationId);
    const adapter = this.createDestinationAdapter(destination);
    const verified = this.store
      .runs(undefined, 10_000)
      .filter(
        (run) => run.planId === plan.planId && run.status === 'verified' && run.prunedAt === null,
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    const protectedRun = verified[0]?.runId;
    const cutoff =
      plan.retention.keepDays === null
        ? null
        : this.now().getTime() - plan.retention.keepDays * 24 * 60 * 60 * 1000;
    for (let index = 0; index < verified.length; index += 1) {
      const run = verified[index]!;
      if (run.runId === protectedRun) continue;
      const tooMany = index >= plan.retention.keepLast;
      const tooOld = cutoff !== null && Date.parse(run.startedAt) < cutoff;
      if (!tooMany && !tooOld) continue;
      try {
        await adapter.delete(run.archiveName);
        this.updateRun({ ...run, prunedAt: this.now().toISOString() });
      } catch {
        // A failed prune keeps the verified archive registered for a later retry.
      }
    }
  }

  private finishPlan(planId: string, finishedAt: string): void {
    const plan = this.store.plan(planId);
    if (!plan) return;
    this.store.savePlan({
      ...plan,
      lastRunAt: finishedAt,
      nextRunAt: plan.enabled ? nextBackupTime(plan.schedule, finishedAt, this.now()) : null,
      updatedAt: finishedAt,
    });
  }

  private async verifyArchiveExists(
    destination: BackupDestination,
    archiveName: string,
  ): Promise<void> {
    const exists = (await this.createDestinationAdapter(destination).list()).some(
      (entry) => entry.archiveName === archiveName,
    );
    if (!exists)
      throw new RpcError('Backup archive not found.', RpcErrorCode.BackupArchiveNotFound);
  }

  private async requireArchive(destination: BackupDestination, archiveName: string): Promise<void> {
    await this.verifyArchiveExists(destination, archiveName);
  }

  private prepareRestoredProject(
    targetPath: string,
    manifest: BackupManifest,
    warnings: string[],
  ): void {
    const manifestPath = path.join(targetPath, PROJECT_MANIFEST_FILENAME);
    const projectManifest = projectManifestValidator.assert(
      JSON.parse(readFileSync(manifestPath, 'utf8')),
    );
    const existing = this.options.projects.getById(projectManifest.projectId);
    if (!existing || path.resolve(existing.path) === path.resolve(targetPath)) return;

    const previousProjectId = projectManifest.projectId;
    const restoredProjectManifest = projectManifestValidator.assert({
      ...projectManifest,
      projectId: uuidv7(),
      restoredFrom: {
        projectId: previousProjectId,
        archiveId: manifest.archiveId,
        restoredAt: this.now().toISOString(),
      },
    });
    writeFileSync(manifestPath, `${JSON.stringify(restoredProjectManifest, null, 2)}\n`, 'utf8');
    rewriteProjectDatabaseId(
      path.join(targetPath, '.gamecrafter', 'project.sqlite'),
      previousProjectId,
      restoredProjectManifest.projectId,
    );
    warnings.push(
      `The restored Project ID was changed from ${previousProjectId} because it is already registered at another path.`,
    );
  }

  private settingValue<T>(key: string, projectId: string | undefined, fallback: T): T {
    try {
      return this.options.settings.resolve(key, projectId ? { projectId } : {}).value as T;
    } catch {
      return fallback;
    }
  }

  private settingNumber(key: string, projectId: string | undefined, fallback: number): number {
    const value = this.settingValue<number>(key, projectId, fallback);
    return Number.isFinite(value) ? value : fallback;
  }

  private stagingDirectory(): string {
    const configured = this.settingValue<string>('backup.stagingDirectory', undefined, '');
    return configured.trim()
      ? path.resolve(configured)
      : path.join(this.options.profileDir, 'cache', 'backup-staging');
  }

  private requireIdentity(identityId: string): BackupIdentity {
    const identity = this.store.identity(identityId);
    if (!identity)
      throw new RpcError('Backup identity not found.', RpcErrorCode.BackupIdentityNotFound);
    return identityValidator.assert(identity);
  }

  private requireDestination(destinationId: string): BackupDestination {
    const destination = this.store.destination(destinationId);
    if (!destination)
      throw new RpcError('Backup destination not found.', RpcErrorCode.BackupDestinationNotFound);
    return destinationValidator.assert(destination);
  }

  private createDestinationAdapter(destination: BackupDestination): BackupDestinationAdapter {
    return this.destinations.create(destination, this.destinationSecrets(destination));
  }

  private destinationSecrets(destination: BackupDestination): Record<string, string> {
    const names = secretNames(destination.kind);
    const result: Record<string, string> = {};
    for (const name of names) {
      const secret = this.options.credentials.get(
        `backup-destination/${destination.destinationId}/${name}`,
      );
      if (secret !== undefined) result[name] = secret;
    }
    return result;
  }

  private storeSecrets(
    destinationId: string,
    kind: BackupDestinationKind,
    secrets: Record<string, string>,
  ): void {
    const allowed = new Set(secretNames(kind));
    for (const [name, value] of Object.entries(secrets)) {
      if (!allowed.has(name))
        throw new RpcError(`Unknown ${kind} destination secret.`, RpcErrorCode.InvalidParams);
      const ref = `backup-destination/${destinationId}/${name}`;
      if (value.length === 0) this.options.credentials.delete(ref);
      else this.options.credentials.put(ref, value);
    }
  }

  private hasRequiredSecrets(destinationId: string, kind: BackupDestinationKind): boolean {
    const required = requiredSecretNames(kind);
    return (
      required.length > 0 &&
      required.every(
        (name) =>
          this.options.credentials.get(`backup-destination/${destinationId}/${name}`) !== undefined,
      )
    );
  }

  private validateDestinationConfig(
    kind: BackupDestinationKind,
    config: BackupDestinationConfig,
  ): void {
    try {
      destinationConfigValidator.assert(config);
    } catch {
      throw new RpcError('Destination config is invalid.', RpcErrorCode.InvalidParams);
    }
    const valid =
      (kind === 'local' && 'directory' in config) ||
      (kind === 's3' && 'bucket' in config && 'region' in config) ||
      (kind === 'ftp' && 'host' in config && 'port' in config) ||
      (kind === 'google-drive' && 'folderId' in config && 'clientId' in config);
    if (!valid)
      throw new RpcError('Destination config does not match its kind.', RpcErrorCode.InvalidParams);
  }

  private validatePlanScope(scope: BackupScope, projectId: string | null): void {
    if (scope === 'profile' && projectId !== null) {
      throw new RpcError(
        'Profile backup plans must not reference a Project.',
        RpcErrorCode.InvalidParams,
      );
    }
    if (scope === 'project' && !projectId) {
      throw new RpcError('Project backup plans require a Project ID.', RpcErrorCode.InvalidParams);
    }
  }

  private updateRun(run: BackupRun): void {
    const validated = runValidator.assert(run);
    this.store.saveRun(validated);
    this.emit(validated);
  }

  private emit(run: BackupRun): void {
    this.options.events.runChanged(run);
  }
}

function secretNames(kind: BackupDestinationKind): string[] {
  switch (kind) {
    case 's3':
      return ['accessKeyId', 'secretAccessKey', 'sessionToken'];
    case 'ftp':
      return ['password'];
    case 'google-drive':
      return ['clientSecret', 'refreshToken'];
    case 'local':
      return [];
  }
}

function requiredSecretNames(kind: BackupDestinationKind): string[] {
  switch (kind) {
    case 's3':
      return ['accessKeyId', 'secretAccessKey'];
    case 'ftp':
      return ['password'];
    case 'google-drive':
      return ['clientSecret', 'refreshToken'];
    case 'local':
      return [];
  }
}

function makeArchiveName(
  scope: BackupScope,
  projectId: string | null,
  createdAt: string,
  archiveId: string,
): string {
  const timestamp = createdAt.replace(/[:.]/g, '-');
  return `${scope}-${projectId ?? 'profile'}-${timestamp}-${archiveId.replaceAll('-', '').slice(0, 8)}.gcbackup`;
}

function redact(error: unknown, secrets: Record<string, string>): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of Object.values(secrets)) {
    if (value) message = message.split(value).join('[REDACTED]');
  }
  return message.slice(0, 1000);
}

function mapArchiveError(error: unknown, secrets: Record<string, string>): RpcError {
  if (error instanceof RpcError) return error;
  return new RpcError(
    `Backup archive operation failed: ${redact(error, secrets)}`,
    RpcErrorCode.BackupDestinationFailed,
  );
}

function mapRestoreError(
  error: unknown,
  secrets: Record<string, string>,
  recoverySecret: string,
): RpcError {
  if (error instanceof RpcError) return error;
  return new RpcError(
    `Backup restore failed: ${redact(error, { ...secrets, recoverySecret })}`,
    RpcErrorCode.BackupDestinationFailed,
  );
}

async function verifyArchiveWithKey(
  archivePath: string,
  archiveKey: Buffer,
  manifest: BackupManifest,
): Promise<void> {
  const fileDigests = new Map<string, { sha256: string; bytes: number }>();
  const result = await readArchiveWithKey(createReadStream(archivePath), archiveKey, {
    onEntry: async (entry, content) => {
      if (entry.kind !== 'file') {
        for await (const chunk of content) {
          void chunk;
        }
        return;
      }
      const hash = createHash('sha256');
      let bytes = 0;
      for await (const chunk of content) {
        hash.update(chunk);
        bytes += chunk.length;
      }
      fileDigests.set(entry.path, { sha256: hash.digest('hex'), bytes });
    },
  });
  if (result.manifest.archiveId !== manifest.archiveId)
    throw new Error('Backup drill manifest mismatch');
  for (const entry of manifest.entries) {
    if (entry.kind !== 'file') continue;
    const digest = fileDigests.get(entry.path);
    if (!digest || digest.bytes !== entry.bytes || digest.sha256 !== entry.sha256) {
      throw new Error(`Backup drill hash mismatch: ${entry.path}`);
    }
  }
}

function currentMigrationVersion(migrations: Array<{ id: number }>): number {
  return Math.max(0, ...migrations.map((migration) => migration.id));
}

function rewriteProjectDatabaseId(databasePath: string, previousId: string, nextId: string): void {
  const database = Database.open(databasePath);
  try {
    reidentifyProjectDatabase(database, previousId, nextId);
  } finally {
    database.close();
  }
}
