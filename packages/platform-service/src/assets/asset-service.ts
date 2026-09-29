import {
  copyFileSync,
  createWriteStream,
  existsSync,
  constants,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AssetJobSchema,
  AssetProviderAccountSchema,
  RpcError,
  RpcErrorCode,
  compile,
  isTerminalAssetJobStatus,
  isValidAssetJobTransition,
  uuidv7,
  type AssetArtifact,
  type AssetFileEntry,
  type AssetJob,
  type AssetJobRequest,
  type AssetJobStatus,
  type AssetPreview,
  type AssetProviderAccount,
  type RpcParams,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import type { ToolRegistry } from '../tools/tool-registry';
import { AssetStore } from './asset-store';
import { registerAssetTools } from './asset-tools';
import { openInAuthoringTool } from './external-open';
import {
  isWithin,
  projectRelativePath,
  requireExistingProjectPath,
  resolveProjectPath,
} from './path-utils';
import { PreviewService } from './preview/preview-service';
import { AssetProviderRegistry } from './providers/provider-registry';
import {
  safeProviderText,
  type ProviderContext,
  type ProviderTaskOutput,
  type ProviderTaskState,
} from './providers/provider';

const jobValidator = compile<AssetJob>(AssetJobSchema);
const accountValidator = compile<AssetProviderAccount>(AssetProviderAccountSchema);
const TERMS_NOTE =
  'Rights depend on the provider plan and terms in effect when the asset is generated.';

export interface AssetServiceEvents {
  jobChanged(projectId: string, job: AssetJob): void;
}

export interface AssetServiceOptions {
  projects: ProfileStore;
  database: Database;
  projectDatabases: ProjectDatabases;
  credentials: CredentialStore;
  settings: SettingsService;
  toolRegistry: ToolRegistry;
  events: AssetServiceEvents;
  providers?: AssetProviderRegistry;
  fetch?: typeof fetch;
  now?: () => Date;
}

interface RunningTimer {
  timer: NodeJS.Timeout;
  resolve: () => void;
}

export class AssetService {
  private readonly store: AssetStore;
  private readonly previews: PreviewService;
  private readonly providers: AssetProviderRegistry;
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly activeJobs = new Set<string>();
  private readonly runningLoops = new Map<string, Promise<void>>();
  private readonly timers = new Map<string, RunningTimer>();
  private stopped = false;

  constructor(private readonly options: AssetServiceOptions) {
    this.store = new AssetStore(options.database, options.projectDatabases);
    this.providers = options.providers ?? new AssetProviderRegistry();
    this.fetcher = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.previews = new PreviewService({
      projects: options.projects,
      projectDatabases: options.projectDatabases,
      settings: options.settings,
      store: this.store,
      now: this.now,
    });
    registerAssetTools(options.toolRegistry, {
      generate: (projectId, accountId, request, taskId) =>
        this.generate(projectId, accountId, request, taskId),
      job: (projectId, jobId) => this.job(projectId, jobId),
      jobs: (projectId, limit, status) => this.jobs(projectId, limit, status),
      importAsset: (projectId, jobId, artifactId, destinationDir) =>
        this.importAsset(projectId, jobId, artifactId, destinationDir),
      files: (projectId, directory) => this.files(projectId, directory),
      preview: (projectId, sourcePath, refresh) => this.preview(projectId, sourcePath, refresh),
    });
  }

  providersList() {
    return this.providers.list().map((provider) => provider.capabilities());
  }

  accounts(): AssetProviderAccount[] {
    return this.store.accounts().map((account) => accountValidator.assert(account));
  }

  addAccount(input: RpcParams<'asset/addAccount'>): AssetProviderAccount {
    this.assertBaseUrl(input.baseUrl ?? this.providers.get(input.providerKind).defaultBaseUrl());
    const now = this.now().toISOString();
    const account: AssetProviderAccount = accountValidator.assert({
      schemaVersion: 1,
      accountId: uuidv7(),
      providerKind: input.providerKind,
      displayName: input.displayName.trim(),
      baseUrl: input.baseUrl ?? this.providers.get(input.providerKind).defaultBaseUrl(),
      planTier: input.planTier?.trim() || null,
      hasApiKey: true,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    this.options.credentials.put(this.credentialRef(account.accountId), input.apiKey);
    this.store.saveAccount(account);
    return account;
  }

  updateAccount(
    accountId: string,
    patch: RpcParams<'asset/updateAccount'>['patch'],
  ): AssetProviderAccount {
    const current = this.requireAccount(accountId);
    const baseUrl = patch.baseUrl ?? current.baseUrl;
    this.assertBaseUrl(baseUrl);
    if (patch.apiKey === null)
      this.options.credentials.deletePrefix(this.credentialPrefix(accountId));
    else if (typeof patch.apiKey === 'string') {
      this.options.credentials.put(this.credentialRef(accountId), patch.apiKey);
    }
    const updated = accountValidator.assert({
      ...current,
      ...(patch.displayName === undefined ? {} : { displayName: patch.displayName.trim() }),
      baseUrl,
      ...(patch.planTier === undefined ? {} : { planTier: patch.planTier?.trim() || null }),
      ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
      hasApiKey:
        patch.apiKey === null
          ? false
          : typeof patch.apiKey === 'string'
            ? true
            : this.options.credentials.get(this.credentialRef(accountId)) !== undefined,
      updatedAt: this.now().toISOString(),
    });
    this.store.saveAccount(updated);
    return updated;
  }

  removeAccount(accountId: string): void {
    this.requireAccount(accountId);
    this.options.credentials.deletePrefix(this.credentialPrefix(accountId));
    this.store.removeAccount(accountId);
  }

  async testAccount(accountId: string): Promise<{
    ok: boolean;
    latencyMs: number;
    balance: number | null;
    error?: string;
  }> {
    const account = this.requireAccount(accountId);
    const startedAt = Date.now();
    try {
      const adapter = this.providers.get(account.providerKind);
      const context = this.providerContext(account);
      const balance = adapter.test
        ? await adapter.test(context)
        : adapter.balance
          ? await adapter.balance(context)
          : null;
      return { ok: true, latencyMs: Date.now() - startedAt, balance };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        balance: null,
        error: safeProviderText(
          error instanceof Error ? error.message : String(error),
          this.options.credentials.get(this.credentialRef(accountId)),
        ),
      };
    }
  }

  async generate(
    projectId: string,
    accountId: string,
    request: AssetJobRequest,
    taskId?: string,
  ): Promise<AssetJob> {
    const project = this.requireProject(projectId);
    const account = this.requireAccount(accountId);
    if (
      !account.enabled ||
      !account.hasApiKey ||
      !this.options.credentials.get(this.credentialRef(accountId))
    ) {
      throw new RpcError(
        'Asset provider account is disabled or missing an API key.',
        RpcErrorCode.AssetProviderAccountNotFound,
      );
    }
    const adapter = this.providers.get(account.providerKind);
    const capabilities = adapter.capabilities();
    if (
      !capabilities.jobKinds.includes(request.kind) ||
      !capabilities.outputFormats.includes(request.outputFormat)
    ) {
      throw new RpcError(
        'The selected provider does not support this job or output format.',
        RpcErrorCode.InvalidParams,
      );
    }
    if (request.kind === 'text-to-3d' && !request.prompt?.trim()) {
      throw new RpcError('Text-to-3D requires a prompt.', RpcErrorCode.InvalidParams);
    }
    if (request.kind === 'image-to-3d') {
      if (!request.imagePath)
        throw new RpcError('Image-to-3D requires an image path.', RpcErrorCode.InvalidParams);
      const imagePath = requireExistingProjectPath(project.path, request.imagePath);
      const extension = path.extname(imagePath).toLowerCase();
      const allowedExtensions =
        account.providerKind === 'meshy'
          ? ['.png', '.jpg', '.jpeg']
          : ['.png', '.jpg', '.jpeg', '.webp'];
      if (!allowedExtensions.includes(extension)) {
        throw new RpcError(
          'The provider does not support this image format.',
          RpcErrorCode.InvalidParams,
        );
      }
    }
    let sourceJob: AssetJob | undefined;
    if (request.kind === 'refine' || request.kind === 'convert') {
      if (!request.sourceJobId)
        throw new RpcError(`${request.kind} requires a source job.`, RpcErrorCode.InvalidParams);
      sourceJob = this.job(projectId, request.sourceJobId);
      if (
        sourceJob.providerKind !== account.providerKind ||
        !sourceJob.providerTaskId ||
        !['review', 'approved', 'rejected', 'imported'].includes(sourceJob.status)
      ) {
        throw new RpcError(
          'The source job is not compatible with this provider.',
          RpcErrorCode.InvalidParams,
        );
      }
    }
    const now = this.now().toISOString();
    const job = jobValidator.assert({
      schemaVersion: 1,
      jobId: uuidv7(),
      projectId,
      providerKind: account.providerKind,
      accountId,
      status: 'queued',
      progress: 0,
      providerTaskId: null,
      error: null,
      artifacts: [],
      provenance: {
        providerKind: account.providerKind,
        accountId,
        providerTaskId: null,
        planTier: account.planTier,
        request,
        submittedAt: null,
        completedAt: null,
        creditsConsumed: null,
        termsSnapshot: { url: adapter.termsUrl(), capturedAt: now, note: TERMS_NOTE },
        requestedBy: { kind: taskId ? 'task' : 'user', ref: taskId ?? null },
      },
      review: { decision: null, note: null, decidedAt: null },
      importedPath: null,
      taskId: taskId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.saveJob(job);
    this.emit(job);
    this.resumeJob(projectId, job.jobId);
    return job;
  }

  jobs(projectId: string, limit = 100, status?: AssetJobStatus): AssetJob[] {
    this.requireProject(projectId);
    return this.store
      .jobs(projectId, Math.max(1, Math.min(1000, limit)), status)
      .map((job) => jobValidator.assert(job));
  }

  job(projectId: string, jobId: string): AssetJob {
    this.requireProject(projectId);
    const job = this.store.job(projectId, jobId);
    if (!job) throw new RpcError(`Asset job not found: ${jobId}`, RpcErrorCode.AssetJobNotFound);
    return jobValidator.assert(job);
  }

  async cancel(projectId: string, jobId: string): Promise<AssetJob> {
    const job = this.job(projectId, jobId);
    const adapter = this.providers.get(job.providerKind);
    if (adapter.cancel && job.providerTaskId) {
      await adapter.cancel(
        this.providerContext(this.requireAccount(job.accountId)),
        job.providerTaskId,
      );
    }
    return this.transition(job, 'cancelled', { error: null });
  }

  review(
    projectId: string,
    jobId: string,
    decision: 'approved' | 'rejected',
    note: string | undefined,
  ): AssetJob {
    const job = this.job(projectId, jobId);
    const updated = this.transition(job, decision, {
      review: { decision, note: note ?? null, decidedAt: this.now().toISOString() },
    });
    return updated;
  }

  async importAsset(
    projectId: string,
    jobId: string,
    artifactId: string,
    destinationDir?: string,
  ): Promise<{ job: AssetJob; importedPath: string; provenancePath: string }> {
    const project = this.requireProject(projectId);
    const job = this.job(projectId, jobId);
    if (job.status !== 'approved') {
      throw new RpcError(
        'Only an approved asset job can be imported.',
        RpcErrorCode.AssetJobInvalidTransition,
      );
    }
    const artifact = job.artifacts.find((entry) => entry.artifactId === artifactId);
    if (!artifact)
      throw new RpcError(`Asset artifact not found: ${artifactId}`, RpcErrorCode.AssetJobNotFound);
    const configured = this.options.settings.resolve('assets.importDirectory', { projectId }).value;
    const targetDirectory =
      destinationDir ?? (typeof configured === 'string' ? configured : 'game/assets/generated');
    const absoluteDirectory = resolveProjectPath(project.path, targetDirectory);
    mkdirSync(absoluteDirectory, { recursive: true });
    const source = requireExistingProjectPath(project.path, artifact.path);
    const promptSlug = slug(job.provenance.request.prompt || job.provenance.request.kind);
    const shortId = job.jobId.slice(0, 8);
    const extension = safeExtension(artifact.format);
    let importedAbsolutePath = '';
    let provenanceAbsolutePath = '';
    for (let suffix = 1; suffix < 1000; suffix += 1) {
      const suffixText = suffix === 1 ? '' : `-${suffix}`;
      const fileName = `${shortId}-${promptSlug}${suffixText}.${extension}`;
      const candidate = path.join(absoluteDirectory, fileName);
      const sidecar = `${candidate}.gamecrafter-provenance.json`;
      if (existsSync(candidate) || existsSync(sidecar)) continue;
      let copied = false;
      try {
        copyFileSync(source, candidate, constants.COPYFILE_EXCL);
        copied = true;
        writeFileSync(
          sidecar,
          `${JSON.stringify({ schemaVersion: 1, jobId: job.jobId, artifact, provenance: job.provenance }, null, 2)}\n`,
          { flag: 'wx' },
        );
        importedAbsolutePath = candidate;
        provenanceAbsolutePath = sidecar;
        break;
      } catch (error) {
        if (copied) rmSync(candidate, { force: true });
        if (isCode(error, 'EEXIST')) continue;
        throw error;
      }
    }
    if (!importedAbsolutePath)
      throw new Error('Could not find an unused generated-asset filename.');
    const importedPath = projectRelativePath(project.path, importedAbsolutePath);
    const provenancePath = projectRelativePath(project.path, provenanceAbsolutePath);
    const updated = this.transition(job, 'imported', { importedPath });
    return { job: updated, importedPath, provenancePath };
  }

  files(projectId: string, directory?: string): AssetFileEntry[] {
    const project = this.requireProject(projectId);
    const assetsRoot = resolveProjectPath(project.path, 'game/assets');
    if (directory && path.isAbsolute(directory)) {
      throw new RpcError(
        `Asset directory is outside game/assets: ${directory}`,
        RpcErrorCode.AssetPathOutsideProject,
      );
    }
    const requested = directory
      ? resolveProjectPath(
          project.path,
          directory.startsWith('game/assets') ? directory : path.join('game/assets', directory),
        )
      : assetsRoot;
    if (!isWithin(assetsRoot, requested)) {
      throw new RpcError(
        `Asset directory is outside game/assets: ${directory}`,
        RpcErrorCode.AssetPathOutsideProject,
      );
    }
    if (!existsSync(requested)) return [];
    if (!statSync(requested).isDirectory()) {
      throw new RpcError(`Asset path is not a directory: ${directory}`, RpcErrorCode.InvalidParams);
    }
    const result: AssetFileEntry[] = [];
    const visit = (folder: string): void => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const absolutePath = path.join(folder, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          visit(absolutePath);
          continue;
        }
        if (!entry.isFile() || isSkippedAssetFile(entry.name)) continue;
        const stats = statSync(absolutePath);
        const relative = projectRelativePath(project.path, absolutePath);
        const sidecar = `${absolutePath}.gamecrafter-provenance.json`;
        result.push({
          path: relative,
          bytes: stats.size,
          extension: path.extname(entry.name).slice(1).toLowerCase(),
          modifiedAt: stats.mtime.toISOString(),
          provenancePath: existsSync(sidecar) ? projectRelativePath(project.path, sidecar) : null,
        });
      }
    };
    visit(requested);
    return result.sort((left, right) => left.path.localeCompare(right.path));
  }

  preview(projectId: string, sourcePath: string, refresh = false): AssetPreview {
    return this.previews.preview(projectId, sourcePath, refresh);
  }

  async openInAuthoringTool(
    projectId: string,
    sourcePath: string,
  ): Promise<{ launched: boolean; command: string }> {
    const project = this.requireProject(projectId);
    const configured = this.options.settings.resolve('assets.externalOpenCommand', {
      projectId,
    }).value;
    return openInAuthoringTool(
      project.path,
      sourcePath,
      typeof configured === 'string' ? configured : '',
    );
  }

  async start(): Promise<void> {
    this.stopped = false;
    const jobs = this.options.projects.list().flatMap((project) => {
      try {
        return this.store.allJobs([project.projectId]);
      } catch {
        return [];
      }
    });
    for (const job of jobs) {
      if (['queued', 'submitted', 'running', 'downloading'].includes(job.status)) {
        this.resumeJob(job.projectId, job.jobId);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const { timer, resolve } of this.timers.values()) {
      clearTimeout(timer);
      resolve();
    }
    this.timers.clear();
    await Promise.allSettled(this.runningLoops.values());
  }

  onSettingChanged(event: { key: string }): void {
    if (event.key !== 'assets.pollIntervalSeconds') return;
    for (const [key, running] of this.timers) {
      clearTimeout(running.timer);
      this.timers.delete(key);
      running.resolve();
      const [projectId, jobId] = key.split(':');
      if (projectId && jobId) setImmediate(() => this.resumeJob(projectId, jobId));
    }
  }

  private resumeJob(projectId: string, jobId: string): void {
    const key = this.jobKey(projectId, jobId);
    if (this.stopped || this.activeJobs.has(key)) return;
    this.activeJobs.add(key);
    const loop = this.processJob(projectId, jobId)
      .catch((error: unknown) => {
        try {
          const current = this.job(projectId, jobId);
          if (!isTerminalAssetJobStatus(current.status)) {
            this.transition(current, 'failed', {
              error:
                safeProviderText(error instanceof Error ? error.message : String(error)) ||
                'Asset job failed.',
            });
          }
        } catch {
          return;
        }
      })
      .finally(() => {
        this.activeJobs.delete(key);
        this.runningLoops.delete(key);
      });
    this.runningLoops.set(key, loop);
  }

  private async processJob(projectId: string, jobId: string): Promise<void> {
    const key = this.jobKey(projectId, jobId);
    while (!this.stopped) {
      try {
        let job = this.job(projectId, jobId);
        if (
          isTerminalAssetJobStatus(job.status) ||
          ['review', 'approved', 'rejected'].includes(job.status)
        )
          return;
        const account = this.requireAccount(job.accountId);
        const adapter = this.providers.get(job.providerKind);
        const context = this.providerContext(account);
        if (job.status === 'queued') {
          const imageDataUrl = this.imageDataUrl(job);
          const request = { ...job.provenance.request };
          if (job.provenance.request.sourceJobId) {
            const sourceJob = this.job(projectId, job.provenance.request.sourceJobId);
            request.providerOptions = {
              ...(request.providerOptions ?? {}),
              sourceProviderTaskId: sourceJob.providerTaskId,
            };
          }
          const submitted = await adapter.submit(context, request, imageDataUrl);
          if (this.stopped) return;
          const latest = this.job(projectId, jobId);
          if (isTerminalAssetJobStatus(latest.status) || latest.status !== 'queued') return;
          const submittedAt = this.now().toISOString();
          job = this.transition(latest, 'submitted', {
            providerTaskId: submitted.providerTaskId,
            provenance: {
              ...job.provenance,
              providerTaskId: submitted.providerTaskId,
              submittedAt,
            },
          });
          continue;
        }
        const state = await adapter.poll(context, job.providerTaskId ?? '');
        if (this.stopped) return;
        job = this.job(projectId, jobId);
        if (isTerminalAssetJobStatus(job.status)) return;
        job = this.applyProviderState(job, state);
        if (state.status === 'failed' || state.status === 'cancelled' || state.status === 'expired')
          return;
        if (state.status === 'succeeded') {
          if (job.status !== 'downloading') {
            job = this.transition(job, 'downloading', {
              progress: 90,
              provenance: {
                ...job.provenance,
                completedAt: this.now().toISOString(),
                creditsConsumed: state.creditsConsumed,
              },
            });
          }
          const artifacts = await this.downloadOutputs(job, state.outputs);
          if (this.stopped) return;
          const latest = this.job(projectId, jobId);
          if (latest.status === 'cancelled') return;
          this.transition(latest, 'review', { artifacts, progress: 100 });
          return;
        }
        const delayMs = state.retryAfterMs ?? this.pollIntervalMs(projectId);
        if (!(await this.wait(key, delayMs))) return;
      } catch (error) {
        if (this.stopped) return;
        if (isRetryableProviderFailure(error)) {
          try {
            const current = this.job(projectId, jobId);
            if (
              current.status !== 'queued' &&
              !(await this.wait(key, this.pollIntervalMs(projectId)))
            )
              return;
            if (current.status !== 'queued') continue;
          } catch {
            return;
          }
        }
        try {
          const current = this.job(projectId, jobId);
          if (!isTerminalAssetJobStatus(current.status)) {
            const message = safeProviderText(
              error instanceof Error ? error.message : String(error),
            );
            this.transition(current, 'failed', { error: message || 'Asset job failed.' });
          }
        } catch {
          return;
        }
        return;
      }
    }
  }

  private applyProviderState(job: AssetJob, state: ProviderTaskState): AssetJob {
    if (state.status === 'failed')
      return this.transition(job, 'failed', { error: state.error ?? 'Provider task failed.' });
    if (state.status === 'cancelled') return this.transition(job, 'cancelled', { error: null });
    if (state.status === 'expired')
      return this.transition(job, 'expired', { error: state.error ?? 'Provider task expired.' });
    if (state.status === 'running' && job.status === 'submitted') {
      return this.transition(job, 'running', {
        progress: Math.max(1, Math.min(89, state.progress)),
      });
    }
    if (state.status === 'succeeded')
      return this.update(job, { progress: Math.max(job.progress, 90) });
    if (state.status === 'running')
      return this.update(job, { progress: Math.max(job.progress, Math.min(89, state.progress)) });
    return job;
  }

  private async downloadOutputs(
    job: AssetJob,
    outputs: ProviderTaskOutput[],
  ): Promise<AssetArtifact[]> {
    if (outputs.length === 0)
      throw new Error('Provider task succeeded without downloadable outputs.');
    const project = this.requireProject(job.projectId);
    const folderRelative = `.gamecrafter/asset-jobs/${job.jobId}`;
    const folder = resolveProjectPath(project.path, folderRelative);
    mkdirSync(folder, { recursive: true });
    const cap = this.maxDownloadBytes(job.projectId);
    const downloaded: AssetArtifact[] = [];
    for (const [index, output] of outputs.entries()) {
      const safeFormat = safeExtension(output.format);
      const baseName = `${output.kind}.${safeFormat}`;
      const name = downloaded.some((artifact) => path.basename(artifact.path) === baseName)
        ? `${output.kind}-${index + 1}.${safeFormat}`
        : baseName;
      const relativePath = `${folderRelative}/${name}`;
      const absolutePath = resolveProjectPath(project.path, relativePath);
      const { bytes, sha256 } = await this.downloadFile(
        output.url,
        absolutePath,
        cap,
        this.jobKey(job.projectId, job.jobId),
      );
      if (this.stopped) return downloaded;
      downloaded.push({
        artifactId: uuidv7(),
        jobId: job.jobId,
        kind: output.kind,
        format: safeFormat,
        path: relativePath,
        sha256,
        bytes,
        downloadedAt: this.now().toISOString(),
      });
      const current = this.job(job.projectId, job.jobId);
      this.update(current, { progress: 90 + Math.floor(((index + 1) / outputs.length) * 9) });
    }
    return downloaded;
  }

  private async downloadFile(
    url: string,
    destination: string,
    limit: number,
    key: string,
  ): Promise<{ bytes: number; sha256: string }> {
    const parsed = parseOutputUrl(url);
    let response: Response | undefined;
    for (let attempt = 0; attempt <= 4; attempt += 1) {
      try {
        response = await this.fetcher(parsed.toString(), {
          signal: AbortSignal.timeout(this.requestTimeoutMs()),
        });
      } catch (error) {
        if (attempt < 4) {
          if (!(await this.wait(key, Math.min(60_000, 500 * 2 ** attempt)))) {
            throw new Error('Asset service stopped.');
          }
          continue;
        }
        throw new RpcError(
          `Asset provider download failed: ${safeProviderText(error instanceof Error ? error.message : String(error))}`,
          RpcErrorCode.AssetProviderRequestFailed,
        );
      }
      if (response.ok) break;
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        if (!(await this.wait(key, retryAfterMs(response.headers.get('retry-after'), attempt)))) {
          throw new Error('Asset service stopped.');
        }
        continue;
      }
      const text = await response.text().catch(() => '');
      throw new RpcError(
        `Asset provider download failed (HTTP ${response.status})${text ? `: ${safeProviderText(text)}` : ''}`,
        RpcErrorCode.AssetProviderRequestFailed,
      );
    }
    if (!response?.ok || !response.body) {
      throw new RpcError(
        'Asset provider returned an empty download.',
        RpcErrorCode.AssetProviderRequestFailed,
      );
    }
    const hash = createHash('sha256');
    let bytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.byteLength;
        if (bytes > limit) {
          callback(
            new RpcError(
              'Asset download exceeded the configured size limit.',
              RpcErrorCode.AssetDownloadTooLarge,
            ),
          );
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      const body = Readable.fromWeb(
        response.body as unknown as import('node:stream/web').ReadableStream,
      );
      await pipeline(body, limiter, createWriteStream(destination, { flags: 'w' }));
    } catch (error) {
      rmSync(destination, { force: true });
      throw error;
    }
    return { bytes, sha256: hash.digest('hex') };
  }

  private imageDataUrl(job: AssetJob): string | undefined {
    const imagePath = job.provenance.request.imagePath;
    if (!imagePath) return undefined;
    const project = this.requireProject(job.projectId);
    const absolutePath = requireExistingProjectPath(project.path, imagePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const allowedExtensions =
      job.providerKind === 'meshy' ? ['.png', '.jpg', '.jpeg'] : ['.png', '.jpg', '.jpeg', '.webp'];
    if (!allowedExtensions.includes(extension)) {
      throw new RpcError(
        'Image-to-3D requires a provider-supported image format.',
        RpcErrorCode.InvalidParams,
      );
    }
    const mimeType =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.webp'
          ? 'image/webp'
          : 'image/png';
    return `data:${mimeType};base64,${readFileSync(absolutePath).toString('base64')}`;
  }

  private transition(
    job: AssetJob,
    status: AssetJobStatus,
    patch: Partial<AssetJob> = {},
  ): AssetJob {
    if (status !== job.status && !isValidAssetJobTransition(job.status, status)) {
      throw new RpcError(
        `Cannot change asset job from ${job.status} to ${status}.`,
        RpcErrorCode.AssetJobInvalidTransition,
      );
    }
    return this.update(job, { ...patch, status });
  }

  private update(job: AssetJob, patch: Partial<AssetJob>): AssetJob {
    const updated = jobValidator.assert({ ...job, ...patch, updatedAt: this.now().toISOString() });
    this.store.saveJob(updated);
    this.emit(updated);
    return updated;
  }

  private emit(job: AssetJob): void {
    this.options.events.jobChanged(job.projectId, job);
  }

  private providerContext(account: AssetProviderAccount): ProviderContext {
    const apiKey = this.options.credentials.get(this.credentialRef(account.accountId));
    if (!apiKey)
      throw new RpcError(
        'Asset provider account has no API key.',
        RpcErrorCode.AssetProviderAccountNotFound,
      );
    return {
      baseUrl: account.baseUrl,
      apiKey,
      fetch: this.fetcher,
      timeoutMs: this.requestTimeoutMs(),
    };
  }

  private requireAccount(accountId: string): AssetProviderAccount {
    const account = this.store.account(accountId);
    if (!account)
      throw new RpcError(
        `Asset provider account not found: ${accountId}`,
        RpcErrorCode.AssetProviderAccountNotFound,
      );
    return accountValidator.assert(account);
  }

  private requireProject(projectId: string) {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    this.options.projectDatabases.get(projectId);
    return project;
  }

  private assertBaseUrl(baseUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new RpcError('Asset provider base URL is invalid.', RpcErrorCode.InvalidParams);
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) ||
      parsed.username ||
      parsed.password
    ) {
      throw new RpcError(
        'Asset provider base URL must use HTTPS (or loopback HTTP) without embedded credentials.',
        RpcErrorCode.InvalidParams,
      );
    }
  }

  private credentialRef(accountId: string): string {
    return `${this.credentialPrefix(accountId)}apiKey`;
  }

  private credentialPrefix(accountId: string): string {
    return `asset-provider/${accountId}/`;
  }

  private pollIntervalMs(projectId: string): number {
    const value = this.options.settings.resolve('assets.pollIntervalSeconds', { projectId }).value;
    return (typeof value === 'number' ? value : 5) * 1000;
  }

  private maxDownloadBytes(projectId: string): number {
    const value = this.options.settings.resolve('assets.maxDownloadMb', { projectId }).value;
    return (typeof value === 'number' ? value : 200) * 1024 * 1024;
  }

  private requestTimeoutMs(): number {
    const value = this.options.settings.resolve('assets.requestTimeoutMs').value;
    return typeof value === 'number' ? value : 30_000;
  }

  private jobKey(projectId: string, jobId: string): string {
    return `${projectId}:${jobId}`;
  }

  private wait(key: string, milliseconds: number): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => {
          this.timers.delete(key);
          resolve(!this.stopped);
        },
        Math.max(0, milliseconds),
      );
      timer.unref?.();
      this.timers.set(key, { timer, resolve: () => resolve(false) });
    });
  }
}

function parseOutputUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RpcError(
      'Asset provider returned an invalid output URL.',
      RpcErrorCode.AssetProviderRequestFailed,
    );
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) ||
    url.username ||
    url.password
  ) {
    throw new RpcError(
      'Asset provider returned an unsafe output URL.',
      RpcErrorCode.AssetProviderRequestFailed,
    );
  }
  return url;
}

function safeExtension(extension: string): string {
  const normalized = extension
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '');
  return normalized || 'bin';
}

function slug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'asset';
}

function isSkippedAssetFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.meta') ||
    lower.endsWith('.import') ||
    lower.endsWith('.gamecrafter-provenance.json')
  );
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (!(error instanceof RpcError) || error.code !== RpcErrorCode.AssetProviderRequestFailed)
    return false;
  if (!isRecord(error.data)) return true;
  const status = error.data.status;
  return status === null || status === 429 || (typeof status === 'number' && status >= 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function retryAfterMs(header: string | null, attempt: number): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, seconds * 1000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(60_000, Math.max(0, date - Date.now()));
  }
  return Math.min(60_000, 500 * 2 ** attempt);
}
