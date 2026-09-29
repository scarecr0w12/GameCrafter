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
import {
  HandlerRegistry,
  registerBoardMaintenanceHandlers,
  registerBuiltinHandlers,
} from './workers/handler-registry';
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
import { McpConnectionManager } from './mcp/connection-manager';
import { BoardService } from './board/board-service';
import { BoardMaintenanceService } from './board/board-maintenance-service';
import { CanonSyncWorkflow } from './board/canon-sync-workflow';
import { registerBoardMaintenanceTool, registerBoardTools } from './board/board-tools';
import { BoardMaintenanceScheduler } from './board/maintenance-scheduler';
import { PluginHost } from './plugins/plugin-host';
import { PluginInstaller } from './plugins/plugin-installer';
import { PluginRegistry } from './plugins/plugin-registry';
import { PluginService } from './plugins/plugin-service';
import type { IsolationLauncher } from './plugins/isolation/types';

export interface PlatformServiceOptions {
  paths: ServicePaths;
  platformVersion: string;
  onClientEvent?: (event: 'connected' | 'closed') => void;
  onStopRequested?: (checkpoint: boolean) => Promise<void> | void;
  onWorkerStarted?: (taskId: string, pid: number) => void;
  approvalTimeoutOverrideMs?: number;
  pluginLaunchers?: {
    linux?: IsolationLauncher;
    win32?: IsolationLauncher;
    unisolated?: IsolationLauncher;
  };
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
    private readonly mcpConnections: McpConnectionManager,
    private readonly boardMaintenanceScheduler: BoardMaintenanceScheduler,
    private readonly pluginHost: PluginHost,
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
    const pluginInstaller = new PluginInstaller({
      database,
      profileDir: paths.profileDir,
      platformVersion,
      settings: settingsService,
    });
    const pluginRegistry = new PluginRegistry({ database, profile, installer: pluginInstaller });
    const handlerRegistry = new HandlerRegistry();
    registerBuiltinHandlers(handlerRegistry);
    registerBoardMaintenanceHandlers(handlerRegistry);
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
      pluginSkillDirectories: (projectId) => pluginRegistry.skillDirectories(projectId),
    });
    const roleRegistry = new RoleRegistry({
      profile,
      profileDir: paths.profileDir,
      pluginRoleDirectories: (projectId) => pluginRegistry.roleDirectories(projectId),
    });
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
      isToolAvailable: (tool, projectId) => {
        if (!tool.source.startsWith('plugin:')) return true;
        try {
          return pluginRegistry.isEnabledForProject(tool.source.slice('plugin:'.length), projectId);
        } catch {
          return false;
        }
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
    const boardRef: { service?: BoardService } = {};
    const boardMaintenanceRef: { scheduler?: BoardMaintenanceScheduler } = {};
    const board = (): BoardService => {
      if (!boardRef.service) throw new Error('Discussion board service is not initialized');
      return boardRef.service;
    };
    const boardMaintenance = (): BoardMaintenanceScheduler => {
      if (!boardMaintenanceRef.scheduler) throw new Error('Board maintenance is not initialized');
      return boardMaintenanceRef.scheduler;
    };
    const pluginRef: { service?: PluginService } = {};
    const plugins = (): PluginService => {
      if (!pluginRef.service) throw new Error('Plugin service is not initialized');
      return pluginRef.service;
    };
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
      'project/open': async ({ path: projectPath }) => {
        const project = workspace.open(projectPath);
        server.broadcast('project/changed', { kind: 'opened', project });
        await mcpConnections.onProjectOpened(project.projectId);
        await plugins().autoStartProject(project.projectId);
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
          ...(states === undefined ? {} : { states }),
          ...(parentTaskId === undefined ? {} : { parentTaskId }),
          ...(rootTaskId === undefined ? {} : { rootTaskId }),
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
      'mcp/list': ({ projectId }) => ({ connections: mcpConnections.list(projectId) }),
      'mcp/add': ({ config, credentials: mcpCredentials }) =>
        mcpConnections.add(config, mcpCredentials),
      'mcp/update': ({ connectionId, patch, credentials: mcpCredentials }) =>
        mcpConnections.update(connectionId, patch, mcpCredentials),
      'mcp/remove': async ({ connectionId }) => {
        await mcpConnections.remove(connectionId);
        return { removed: true };
      },
      'mcp/connect': ({ connectionId }) => mcpConnections.connect(connectionId),
      'mcp/disconnect': ({ connectionId }) => mcpConnections.disconnect(connectionId),
      'mcp/tools': ({ connectionId }) => mcpConnections.tools(connectionId),
      'mcp/refreshTools': ({ connectionId }) => mcpConnections.tools(connectionId, true),
      'mcp/answer': ({ connectionId, requestId, responses }) => {
        mcpConnections.answer(connectionId, requestId, responses);
        return { answered: true };
      },
      'mcp/classifyTool': async ({ connectionId, toolName, sideEffects, executionMode }) => ({
        tool: await mcpConnections.classifyTool(connectionId, toolName, {
          sideEffects,
          executionMode,
        }),
      }),
      'mcp/log': ({ connectionId, limit }) => ({
        entries: mcpConnections.logEntries(connectionId, limit),
      }),
      'board/threads': ({ projectId, status, kind, tags, search }) => ({
        threads: board().threads(projectId, { status, kind, tags, search }),
      }),
      'board/thread': ({ projectId, threadId, includeMessages, afterSeq, limit }) =>
        board().thread(projectId, threadId, { includeMessages, afterSeq, limit }),
      'board/createThread': ({ projectId, title, kind, tags, links, body, type }) =>
        board().createThread({ projectId, title, kind, tags, links, body, type }, { kind: 'user' }),
      'board/post': ({ projectId, threadId, title, kind, type, body, links, replyTo }) =>
        board().post(
          { projectId, threadId, title, kind, type, body, links, replyTo },
          { kind: 'user' },
        ),
      'board/edit': ({ projectId, messageId, body }) => board().edit(projectId, messageId, body),
      'board/supersede': ({ projectId, messageId, byMessageId }) =>
        board().supersede(projectId, messageId, byMessageId),
      'board/setThreadStatus': ({ projectId, threadId, status }) =>
        board().setThreadStatus(projectId, threadId, status),
      'board/bind': (input) => board().bind(input),
      'board/decisions': ({ projectId, syncStatus }) => ({
        decisions: board().decisions(projectId, syncStatus),
      }),
      'board/decision': ({ projectId, decisionId }) => ({
        decision: board().decision(projectId, decisionId),
        proposals: board().proposals(projectId, decisionId),
      }),
      'board/retrySync': ({ projectId, decisionId }) => {
        const decision = board().decision(projectId, decisionId);
        boardMaintenance().retrySync(projectId, decision);
        return decision;
      },
      'board/subscribe': ({ projectId, subscriber, filter }) =>
        board().subscribe(projectId, subscriber, filter),
      'board/unsubscribe': ({ projectId, subscriptionId }) => {
        board().unsubscribe(projectId, subscriptionId);
        return { removed: true };
      },
      'board/subscriptions': ({ projectId, subscriber }) => ({
        subscriptions: board().subscriptions(projectId, subscriber),
      }),
      'board/summary': ({ projectId, threadId }) => board().summary(projectId, threadId),
      'board/search': ({ projectId, query, limit }) => board().search(projectId, query, limit),
      'board/maintenance/run': ({ projectId, mode }) => ({
        taskId: boardMaintenance().scheduleManual(projectId, mode),
      }),
      'board/maintenance/status': ({ projectId }) => board().maintenanceStatus(projectId),
      'board/delete': ({ projectId, threadId }) => {
        board().deleteThread(projectId, threadId);
        return { deleted: true };
      },
      'plugin/list': ({ projectId }) => ({ plugins: plugins().list(projectId) }),
      'plugin/inspect': ({ source }) => plugins().inspect(source),
      'plugin/install': ({ source, acceptCapabilities }) =>
        plugins().install(source, acceptCapabilities),
      'plugin/uninstall': ({ pluginId }) => plugins().uninstall(pluginId),
      'plugin/enable': ({ pluginId, projectId }) => plugins().enable(pluginId, projectId),
      'plugin/disable': ({ pluginId, projectId }) => plugins().disable(pluginId, projectId),
      'plugin/start': ({ pluginId, projectId }) => plugins().start(pluginId, projectId),
      'plugin/stop': ({ pluginId, projectId }) => plugins().stop(pluginId, projectId),
      'plugin/status': ({ pluginId, projectId }) => plugins().status(pluginId, projectId),
      'plugin/isolationReport': () => plugins().isolationReport(),
      'plugin/log': ({ pluginId, projectId, limit }) => plugins().logs(pluginId, projectId, limit),
      'plugin/setSecret': ({ pluginId, name, value }) => plugins().setSecret(pluginId, name, value),
      'plugin/panel': ({ pluginId, panelId }) => plugins().panel(pluginId, panelId),
      'plugin/modules': () => plugins().modules(),
      'service/stop': ({ checkpoint }) => {
        setTimeout(() => {
          void (async () => {
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
    boardRef.service = new BoardService({
      projectDatabases,
      settings: settingsService,
      events: {
        threadChanged: (projectId, thread) =>
          server.broadcast('board/threadChanged', { projectId, thread }),
        messagePosted: (projectId, message) =>
          server.broadcast('board/messagePosted', { projectId, message }),
        decisionChanged: (projectId, decision) =>
          server.broadcast('board/decisionChanged', { projectId, decision }),
      },
      onBindingDecision: (decision) => {
        boardMaintenanceRef.scheduler?.scheduleSync(decision);
      },
    });
    boardMaintenanceRef.scheduler = new BoardMaintenanceScheduler({
      board: board(),
      tasks: taskService,
      settings: settingsService,
    });
    const canonSync = new CanonSyncWorkflow({
      board: board(),
      projects: profile,
      tasks: taskService,
      tools: toolBroker,
    });
    const boardMaintenanceService = new BoardMaintenanceService({
      board: board(),
      tasks: taskService,
      projects: profile,
      settings: settingsService,
      completion: completionService,
      scheduler: boardMaintenance(),
      canonSync,
    });
    registerBoardTools(toolRegistry, board(), roleRegistry);
    registerBoardMaintenanceTool(toolRegistry, boardMaintenanceService);
    const mcpConnections = new McpConnectionManager({
      database,
      profile,
      credentials,
      settings: settingsService,
      tasks: taskService,
      completion: completionService,
      tools: toolRegistry,
      events: {
        stateChanged: (state) => server.broadcast('mcp/stateChanged', { state }),
        inputRequired: (params) => server.broadcast('mcp/inputRequired', params),
      },
      clientInfo: { name: 'gamecrafter-platform-service', version: platformVersion },
    });
    const pluginHost = new PluginHost({
      database,
      profileDir: paths.profileDir,
      installer: pluginInstaller,
      plugins: pluginRegistry,
      tools: toolRegistry,
      broker: toolBroker,
      settings: settingsService,
      projects: profile,
      credentials,
      completion: completionService,
      board,
      launchers: options.pluginLaunchers,
      onWorkerChanged: (state) => server.broadcast('plugin/workerChanged', { state }),
    });
    pluginRef.service = new PluginService({
      installer: pluginInstaller,
      registry: pluginRegistry,
      host: pluginHost,
      profile,
      settingsRegistry,
      settings: settingsService,
      credentials,
      onChanged: (pluginId) => server.broadcast('plugin/changed', { pluginId }),
    });
    settingsService.onChanged((event) => {
      server.broadcast('settings/changed', event);
      void plugins()
        .settingsChanged(event)
        .catch((error: unknown) => {
          log('warn', 'Plugin settings update failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    });
    const platformService = new PlatformService(
      server,
      database,
      projectDatabases,
      workerSupervisor,
      toolBroker,
      mcpConnections,
      boardMaintenance(),
      pluginHost,
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
    await mcpConnections.start();
    workerSupervisor.start();
    boardMaintenance().start();
    await plugins().autoStartRegisteredProjects();
    return platformService;
  }

  async stop(checkpoint = true): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.boardMaintenanceScheduler.stop();
    await this.pluginHost.stopAll();
    await this.workerSupervisor.stopAll({ checkpoint });
    await this.toolBroker.stopAll();
    await this.mcpConnections.stop();
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
