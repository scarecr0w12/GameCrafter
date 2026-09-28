import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  PROTOCOL_VERSION,
  RpcError,
  RpcErrorCode,
  type ProjectCloneInput,
  type ProjectCreateInput,
  type TaskCreateInput,
} from '@gamecrafter/contracts';
import { Database } from './db/database';
import { IpcServer, type RpcHandlers } from './ipc/server';
import { migrate } from './db/migrator';
import type { ServicePaths } from './paths';
import { profileMigrations } from './profile/migrations';
import { CredentialStore } from './profile/credential-store';
import { ProfileStore } from './profile/profile-store';
import { ProjectDatabases } from './projects/project-databases';
import { ProjectWorkspace } from './projects/workspace';
import { createBuiltinSettings } from './settings/definitions';
import { SettingsRegistry } from './settings/registry';
import { SettingsService } from './settings/settings-service';
import { TaskService } from './tasks/task-service';
import { HandlerRegistry, registerBuiltinHandlers } from './workers/handler-registry';
import { WorkerSupervisor } from './workers/supervisor';
import { log } from './logger';
import { CompletionService } from './models/completion-service';
import { ModelRegistry } from './models/model-registry';
import { ModelRouter } from './models/router';
import { createBuiltinModelProviders } from './models/providers';
import { RoleRegistry } from './roles/role-registry';
import { SkillCatalog } from './skills/skill-catalog';
import { SkillInstaller } from './skills/skill-installer';
import { SkillRegistry } from './skills/skill-registry';
import { SkillService } from './skills/skill-service';
import { registerSkillTools } from './skills/skill-tools';
import { ToolBroker } from './tools/tool-broker';
import { registerBuiltinTools } from './tools/builtin-tools';
import { ToolRegistry } from './tools/tool-registry';

export interface PlatformServiceOptions {
  paths: ServicePaths;
  platformVersion: string;
  onClientEvent?: (event: 'connected' | 'closed') => void;
  onStopRequested?: (checkpoint: boolean) => Promise<void> | void;
  onWorkerStarted?: (taskId: string, pid: number) => void;
  approvalTimeoutOverrideMs?: number;
}

export class PlatformService {
  readonly socketPath: string;
  readonly startedAt: string;
  private stopped = false;

  private constructor(
    private readonly server: IpcServer,
    private readonly database: Database,
    private readonly projectDatabases: ProjectDatabases,
    private readonly workerSupervisor: WorkerSupervisor,
    private readonly toolBroker: ToolBroker,
    paths: ServicePaths,
    startedAt: string,
  ) {
    this.socketPath = paths.socketPath;
    this.startedAt = startedAt;
  }

  static async start(options: PlatformServiceOptions): Promise<PlatformService> {
    const { paths, platformVersion } = options;
    mkdirSync(paths.profileDir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(paths.profileDir, 0o700);
    mkdirSync(paths.logDir, { recursive: true, mode: 0o700 });
    const token = loadOrCreateToken(paths);
    const database = Database.open(paths.profileDbPath);
    migrate(database, profileMigrations);
    const profile = new ProfileStore(database);
    const workspace = new ProjectWorkspace({ profile, platformVersion });
    const projectDatabases = new ProjectDatabases(profile);
    const settingsRegistry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
    const settingsService = new SettingsService(settingsRegistry, database, projectDatabases);
    const credentials = new CredentialStore(database, paths.profileDir);
    const modelProviders = createBuiltinModelProviders();
    const modelRegistry = new ModelRegistry(database, credentials, modelProviders);
    const modelRouter = new ModelRouter({
      database,
      registry: modelRegistry,
      settings: settingsService,
    });
    const completionService = new CompletionService(modelRegistry, modelRouter);
    const handlerRegistry = new HandlerRegistry();
    registerBuiltinHandlers(handlerRegistry);
    const taskService = new TaskService(
      profile,
      projectDatabases,
      settingsService,
      handlerRegistry,
      {
        taskChanged: (projectId, task) => server.broadcast('task/changed', { projectId, task }),
        taskEvent: (projectId, event) => server.broadcast('task/event', { projectId, event }),
        taskQuestion: (projectId, question) =>
          server.broadcast('task/question', { projectId, question }),
      },
    );
    const skillInstaller = new SkillInstaller(database, paths.profileDir, settingsService);
    const skillRegistry = new SkillRegistry({
      profile,
      projectDatabases,
      installer: skillInstaller,
      settings: settingsService,
    });
    const roleRegistry = new RoleRegistry({ profile, profileDir: paths.profileDir });
    const skillCatalog = new SkillCatalog({
      registry: skillRegistry,
      workspace,
      projectDatabases,
      settings: settingsService,
    });
    const skillService = new SkillService(
      skillInstaller,
      skillRegistry,
      skillCatalog,
      roleRegistry,
      taskService,
      settingsService,
    );
    const toolRegistry = new ToolRegistry();
    registerBuiltinTools(toolRegistry, {
      readOnlyRoots: (projectId) => skillService.readableSkillRoots(projectId),
    });
    registerSkillTools(toolRegistry, skillService);
    const toolBroker = new ToolBroker({
      registry: toolRegistry,
      settings: settingsService,
      projectDatabases,
      projects: profile,
      tasks: taskService,
      events: {
        approvalRequested: (projectId, approval) =>
          server.broadcast('broker/approvalRequested', { projectId, approval }),
        approvalResolved: (projectId, approval) =>
          server.broadcast('broker/approvalResolved', { projectId, approval }),
        toolCalled: (projectId, call) => server.broadcast('tool/called', { projectId, call }),
      },
      approvalTimeoutOverrideMs: options.approvalTimeoutOverrideMs,
    });
    const workerSupervisor = new WorkerSupervisor({
      tasks: taskService,
      settings: settingsService,
      handlers: handlerRegistry,
      tools: toolBroker,
      onWorkerStarted: options.onWorkerStarted,
    });
    taskService.setSupervisor(workerSupervisor);
    const startedAt = new Date().toISOString();
    const handlers: RpcHandlers = {
      'service/info': () => ({
        serviceVersion: platformVersion,
        protocolVersion: PROTOCOL_VERSION,
        pid: process.pid,
        profileDir: paths.profileDir,
        startedAt,
        projectCount: profile.list().length,
      }),
      'project/create': async (input: ProjectCreateInput) => {
        const project = await workspace.create(input);
        server.broadcast('project/changed', { kind: 'created', project });
        return project;
      },
      'project/clone': async (input: ProjectCloneInput) => {
        const project = await workspace.clone(input);
        server.broadcast('project/changed', { kind: 'cloned', project });
        return project;
      },
      'project/list': () => ({ projects: workspace.list() }),
      'project/open': ({ path: projectPath }) => {
        const project = workspace.open(projectPath);
        server.broadcast('project/changed', { kind: 'opened', project });
        return project;
      },
      'project/get': ({ projectId }) => workspace.get(projectId),
      'project/trust': ({ projectId, trusted }) => workspace.trust(projectId, trusted),
      'settings/describe': () => settingsService.describe(),
      'settings/get': (params, context) =>
        settingsService.resolve(params.key, {
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      'settings/getAll': (params, context) => ({
        settings: settingsService.getAll({
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      }),
      'settings/set': (params, context) =>
        settingsService.set(params.key, params.scope, params.value, {
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      'task/create': (input: TaskCreateInput) => taskService.create(input),
      'task/get': ({ projectId, taskId }) => taskService.get(projectId, taskId),
      'task/list': ({ projectId, states, parentTaskId, rootTaskId, limit }) => ({
        tasks: taskService.list(projectId, {
          states,
          parentTaskId,
          rootTaskId,
          limit: limit ?? 200,
        }),
      }),
      'task/tree': ({ projectId, rootTaskId }) => ({
        tasks: taskService.tree(projectId, rootTaskId),
      }),
      'task/cancel': ({ projectId, taskId, reason }) =>
        taskService.cancel(projectId, taskId, reason),
      'task/events': ({ projectId, taskId, afterSeq, limit }) => ({
        events: taskService.eventsForProject(projectId, {
          taskId,
          afterSeq,
          limit: limit ?? 500,
        }),
      }),
      'task/answer': ({ projectId, taskId, questionId, answer }) =>
        taskService.answer(projectId, taskId, questionId, answer),
      'task/questions': ({ pendingOnly }) => ({
        questions: taskService.questions(pendingOnly ?? false),
      }),
      'tool/list': ({ projectId }) => ({ tools: toolBroker.listTools(projectId) }),
      'tool/call': (request, context) => toolBroker.call(request, { sessionId: context.sessionId }),
      'tool/calls': ({ projectId, taskId, toolId, limit }) => ({
        calls: toolBroker.listCalls(projectId, { taskId, toolId, limit: limit ?? 200 }),
      }),
      'broker/approvals': ({ projectId, pendingOnly }) => ({
        approvals: toolBroker.listApprovals(projectId, pendingOnly ?? false),
      }),
      'broker/approve': ({ projectId, approvalId, approve, reason }) =>
        toolBroker.approve(projectId, approvalId, approve, reason),
      'provider/accounts': () => ({ accounts: modelRegistry.listAccounts() }),
      'provider/addAccount': (input) => modelRegistry.addAccount(input),
      'provider/updateAccount': ({ accountId, patch }) =>
        modelRegistry.updateAccount(accountId, patch),
      'provider/removeAccount': ({ accountId }) => {
        modelRegistry.removeAccount(accountId);
        return { removed: true };
      },
      'provider/testAccount': ({ accountId }) => modelRegistry.testAccount(accountId),
      'model/list': ({ accountId, enabledOnly }) => ({
        models: modelRegistry.listModels({ accountId, enabledOnly: enabledOnly ?? false }),
      }),
      'model/discover': ({ accountId }) => modelRegistry.discover(accountId),
      'model/update': ({ modelId, patch }) => modelRegistry.updateModel(modelId, patch),
      'pool/list': ({ projectId }) => ({ pools: modelRegistry.listPools(projectId) }),
      'pool/create': (input) => {
        if (input.scope === 'project' && input.projectId && !profile.getById(input.projectId)) {
          throw new RpcError(`Project not found: ${input.projectId}`, RpcErrorCode.ProjectNotFound);
        }
        return modelRegistry.createPool(input);
      },
      'pool/update': ({ poolId, patch }) => {
        const scope = patch.scope;
        const projectId = patch.projectId;
        if ((scope === 'project' || projectId) && projectId && !profile.getById(projectId)) {
          throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
        }
        return modelRegistry.updatePool(poolId, patch);
      },
      'pool/delete': ({ poolId }) => {
        modelRegistry.deletePool(poolId);
        return { removed: true };
      },
      'router/route': (request, context) => modelRouter.route(request, context.sessionId),
      'router/reportOutcome': (outcome) => {
        modelRouter.reportOutcome(outcome);
        return { recorded: true };
      },
      'router/decisions': ({ projectId, limit }) => ({
        decisions: modelRouter.decisions(projectId, limit ?? 200),
      }),
      'router/stats': ({ taskType }) => ({ models: modelRouter.stats(taskType) }),
      'model/complete': (request, context) =>
        completionService.complete(request, {
          sessionId: context.sessionId,
          notify: context.notify,
        }),
      'model/embed': ({ modelId, inputs }) => completionService.embed(modelId, inputs),
      'skills/install': async ({ source, name, force }) => ({
        installed: await skillService.install(source, name, force ?? false),
      }),
      'skills/uninstall': ({ name }) => {
        skillService.uninstall(name);
        return { removed: true };
      },
      'skills/list': ({ projectId }) => ({
        skills: projectId ? skillService.list(projectId) : skillService.listPlatform(),
      }),
      'skills/enable': ({ projectId, name, enabled, roles, workTypes, pin }) =>
        skillService.enable(projectId, { name, enabled, roles, workTypes, pin }),
      'skills/catalog': (request, context) => skillService.catalog(request, context.sessionId),
      'skills/activate': (request, context) =>
        skillService.activate(
          request.projectId,
          request.name,
          request.taskId,
          request.agentId,
          context.sessionId,
        ),
      'skills/search': (request, context) => ({
        entries: skillService.search(
          request.projectId,
          request.query,
          request.agentRole,
          request.workType,
          context.sessionId,
        ),
      }),
      'skills/validate': ({ path: skillPath }) => skillService.validate(skillPath),
      'skills/activations': ({ projectId, taskId }) => ({
        activations: skillService.activations(projectId, taskId),
      }),
      'roles/list': ({ projectId }) => ({ roles: skillService.listRoles(projectId) }),
      'roles/get': ({ name, projectId }) => skillService.getRole(name, projectId),
      'service/stop': ({ checkpoint }) => {
        setTimeout(() => {
          void (async () => {
            await workerSupervisor.stopAll({ checkpoint });
            await toolBroker.stopAll();
            await platformService.stop(checkpoint);
            await options.onStopRequested?.(checkpoint);
          })().catch((error: unknown) => {
            log('error', 'Service stop request failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }, 50);
        return { ok: true };
      },
    };
    const server = new IpcServer({
      paths,
      handlers,
      token,
      serviceVersion: platformVersion,
      onClientEvent: options.onClientEvent,
      onSessionOpened: (sessionId) => settingsService.openSession(sessionId),
      onSessionClosed: (sessionId) => settingsService.closeSession(sessionId),
    });
    settingsService.onChanged((event) => server.broadcast('settings/changed', event));
    const platformService = new PlatformService(
      server,
      database,
      projectDatabases,
      workerSupervisor,
      toolBroker,
      paths,
      startedAt,
    );

    try {
      await toolBroker.recoverOnStart();
      workerSupervisor.recoverOnStart();
      await server.listen();
    } catch (error) {
      await server.close();
      projectDatabases.close();
      database.close();
      throw error;
    }
    workerSupervisor.start();
    return platformService;
  }

  async stop(checkpoint = true): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    await this.workerSupervisor.stopAll({ checkpoint });
    await this.toolBroker.stopAll();
    await this.server.close();
    this.projectDatabases.close();
    this.database.close();
  }
}

function sessionIdForRequest(requested: string | undefined, connectionSessionId: string): string {
  if (requested && requested !== connectionSessionId) {
    throw new RpcError(`Unknown session: ${requested}`, RpcErrorCode.UnknownSession);
  }
  return connectionSessionId;
}

function loadOrCreateToken(paths: ServicePaths): string {
  try {
    return readFileSync(paths.tokenPath, 'utf8').trim();
  } catch (error) {
    if (!isCode(error, 'ENOENT')) throw error;
  }

  const token = randomBytes(32).toString('hex');
  try {
    writeFileSync(paths.tokenPath, `${token}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!isCode(error, 'EEXIST')) throw error;
    return readFileSync(paths.tokenPath, 'utf8').trim();
  }
  return token;
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
