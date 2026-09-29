import type {
  AccessMode,
  ApprovalRequest,
  EffectiveSetting,
  ExecutionMode,
  McpConnectionConfig,
  McpConnectionInput,
  McpConnectionListEntry,
  McpConnectionLogEntry,
  McpConnectionPatch,
  McpConnectionState,
  McpToolsResult,
  Model,
  ModelCapabilities,
  ModelPool,
  ModelPoolTarget,
  ModelPricing,
  ProjectCreateInput,
  ProjectSummary,
  ProjectSkillEntry,
  ProviderAccount,
  RoleRecord,
  ProviderKind,
  RouteDecision,
  RouteOutcome,
  RpcNotificationParams,
  RpcParams,
  RpcResult,
  SkillActivation,
  SkillCatalogEntry,
  SkillEnablement,
  SkillRecord,
  ServiceInfo,
  SideEffect,
  SettingDefinition,
  SettingGroup,
  SettingsScope,
  TaskCreateInput,
  TaskQuestion,
  TaskRecord,
  ToolCallRecord,
  ToolDefinition,
} from '@gamecrafter/contracts';

export const ControlRoomService = Symbol('ControlRoomService');
export const CONTROL_ROOM_SERVICE_PATH = '/services/gamecrafter/control-room';

export interface ControlRoomService {
  getServiceInfo(): Promise<ServiceInfo>;
  listProjects(): Promise<ProjectSummary[]>;
  createProject(input: ProjectCreateInput): Promise<ProjectSummary>;
  openProject(path: string): Promise<ProjectSummary>;
  getDefaultProjectsDirectory(): Promise<string>;
  describeSettings(): Promise<{ groups: SettingGroup[]; definitions: SettingDefinition[] }>;
  getAllSettings(projectId?: string): Promise<EffectiveSetting[]>;
  setSetting(
    key: string,
    scope: SettingsScope,
    value: unknown,
    projectId?: string,
  ): Promise<EffectiveSetting>;
  listTasks(projectId: string): Promise<TaskRecord[]>;
  createTask(input: TaskCreateInput): Promise<{ task: TaskRecord; deduplicated: boolean }>;
  cancelTask(projectId: string, taskId: string, reason?: string): Promise<string[]>;
  answerQuestion(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<TaskRecord>;
  listTools(projectId?: string): Promise<ToolDefinition[]>;
  callTool(
    projectId: string,
    toolId: string,
    input: unknown,
    options?: {
      taskId?: string;
      agentId?: string;
      accessCeiling?: AccessMode;
    },
  ): Promise<ToolCallRecord>;
  listApprovals(projectId: string, pendingOnly?: boolean): Promise<ApprovalRequest[]>;
  approve(
    projectId: string,
    approvalId: string,
    approve: boolean,
    reason?: string,
  ): Promise<ApprovalRequest>;
  listProviderAccounts(): Promise<ProviderAccount[]>;
  addProviderAccount(input: {
    providerKind: ProviderKind;
    displayName: string;
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    isLocal?: boolean;
  }): Promise<ProviderAccount>;
  updateProviderAccount(
    accountId: string,
    patch: {
      displayName?: string;
      baseUrl?: string;
      apiKey?: string | null;
      headers?: Record<string, string>;
      enabled?: boolean;
      isLocal?: boolean;
    },
  ): Promise<ProviderAccount>;
  removeProviderAccount(accountId: string): Promise<void>;
  testProviderAccount(accountId: string): Promise<{
    ok: boolean;
    latencyMs: number;
    discoveredModels: number;
    error?: string;
  }>;
  listModels(accountId?: string, enabledOnly?: boolean): Promise<Model[]>;
  discoverModels(accountId: string): Promise<{ added: number; updated: number; models: Model[] }>;
  updateModel(
    modelId: string,
    patch: {
      enabled?: boolean;
      displayName?: string;
      capabilities?: Partial<ModelCapabilities>;
      pricing?: ModelPricing;
      tags?: string[];
      workTypes?: string[];
      roles?: string[];
    },
  ): Promise<Model>;
  listModelPools(projectId?: string): Promise<ModelPool[]>;
  createModelPool(input: {
    name: string;
    scope: 'platform' | 'project';
    projectId?: string;
    target: ModelPoolTarget | null;
    modelIds: string[];
  }): Promise<ModelPool>;
  updateModelPool(
    poolId: string,
    patch: {
      name?: string;
      scope?: 'platform' | 'project';
      projectId?: string | null;
      target?: ModelPoolTarget | null;
      modelIds?: string[];
    },
  ): Promise<ModelPool>;
  deleteModelPool(poolId: string): Promise<void>;
  listRouteDecisions(
    projectId?: string,
    limit?: number,
  ): Promise<Array<{ decision: RouteDecision; outcome: RouteOutcome | null }>>;
  routerStats(taskType?: string): Promise<{
    models: Array<{
      modelId: string;
      taskType: string | null;
      observations: number;
      successRate: number;
      qualityMean: number | null;
      meanCostUsd: number | null;
      meanLatencyMs: number | null;
    }>;
  }>;
  listSkills(projectId?: string): Promise<ProjectSkillEntry[]>;
  installSkills(source: string, name?: string, force?: boolean): Promise<SkillRecord[]>;
  uninstallSkill(name: string): Promise<void>;
  enableSkill(input: {
    projectId: string;
    name: string;
    enabled: boolean;
    roles?: string[] | null;
    workTypes?: string[] | null;
    pin?: boolean;
  }): Promise<SkillEnablement>;
  previewSkillCatalog(input: {
    projectId: string;
    agentRole?: string;
    workType?: string;
    taskText?: string;
    accessMode?: AccessMode;
  }): Promise<{ entries: SkillCatalogEntry[]; truncated: boolean }>;
  searchSkills(input: {
    projectId: string;
    query: string;
    agentRole?: string;
    workType?: string;
  }): Promise<{ entries: SkillCatalogEntry[] }>;
  validateSkill(path: string): Promise<{
    ok: boolean;
    errors: string[];
    warnings: string[];
    record: SkillRecord | null;
  }>;
  listSkillActivations(projectId: string, taskId?: string): Promise<SkillActivation[]>;
  listRoles(projectId?: string): Promise<RoleRecord[]>;
  getRole(name: string, projectId?: string): Promise<RoleRecord>;
  trustProject(projectId: string, trusted: boolean): Promise<ProjectSummary>;
  listMcpConnections(projectId?: string): Promise<McpConnectionListEntry[]>;
  addMcpConnection(
    config: McpConnectionInput,
    credentials?: Record<string, string>,
  ): Promise<McpConnectionConfig>;
  updateMcpConnection(
    connectionId: string,
    patch: McpConnectionPatch,
    credentials?: Record<string, string>,
  ): Promise<McpConnectionConfig>;
  removeMcpConnection(connectionId: string): Promise<void>;
  connectMcpConnection(connectionId: string): Promise<McpConnectionState>;
  disconnectMcpConnection(connectionId: string): Promise<McpConnectionState>;
  listMcpTools(connectionId: string): Promise<McpToolsResult>;
  refreshMcpTools(connectionId: string): Promise<McpToolsResult>;
  answerMcpInput(connectionId: string, requestId: string, responses: unknown): Promise<void>;
  classifyMcpTool(
    connectionId: string,
    toolName: string,
    sideEffects?: SideEffect,
    executionMode?: ExecutionMode,
  ): Promise<ToolDefinition>;
  listMcpLogs(connectionId: string, limit?: number): Promise<McpConnectionLogEntry[]>;
  listBoardThreads(params: RpcParams<'board/threads'>): Promise<RpcResult<'board/threads'>>;
  getBoardThread(params: RpcParams<'board/thread'>): Promise<RpcResult<'board/thread'>>;
  createBoardThread(
    params: RpcParams<'board/createThread'>,
  ): Promise<RpcResult<'board/createThread'>>;
  postBoardMessage(params: RpcParams<'board/post'>): Promise<RpcResult<'board/post'>>;
  editBoardMessage(params: RpcParams<'board/edit'>): Promise<RpcResult<'board/edit'>>;
  supersedeBoardMessage(
    params: RpcParams<'board/supersede'>,
  ): Promise<RpcResult<'board/supersede'>>;
  setBoardThreadStatus(
    params: RpcParams<'board/setThreadStatus'>,
  ): Promise<RpcResult<'board/setThreadStatus'>>;
  bindBoardDecision(params: RpcParams<'board/bind'>): Promise<RpcResult<'board/bind'>>;
  listBoardDecisions(params: RpcParams<'board/decisions'>): Promise<RpcResult<'board/decisions'>>;
  getBoardDecision(params: RpcParams<'board/decision'>): Promise<RpcResult<'board/decision'>>;
  retryBoardSync(params: RpcParams<'board/retrySync'>): Promise<RpcResult<'board/retrySync'>>;
  subscribeBoard(params: RpcParams<'board/subscribe'>): Promise<RpcResult<'board/subscribe'>>;
  unsubscribeBoard(params: RpcParams<'board/unsubscribe'>): Promise<RpcResult<'board/unsubscribe'>>;
  listBoardSubscriptions(
    params: RpcParams<'board/subscriptions'>,
  ): Promise<RpcResult<'board/subscriptions'>>;
  getBoardSummary(params: RpcParams<'board/summary'>): Promise<RpcResult<'board/summary'>>;
  searchBoard(params: RpcParams<'board/search'>): Promise<RpcResult<'board/search'>>;
  runBoardMaintenance(
    params: RpcParams<'board/maintenance/run'>,
  ): Promise<RpcResult<'board/maintenance/run'>>;
  getBoardMaintenanceStatus(
    params: RpcParams<'board/maintenance/status'>,
  ): Promise<RpcResult<'board/maintenance/status'>>;
  deleteBoardThread(params: RpcParams<'board/delete'>): Promise<RpcResult<'board/delete'>>;
}

export interface ControlRoomClient {
  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void;
  onSettingsChanged(event: RpcNotificationParams<'settings/changed'>): void;
  onTaskChanged(event: { projectId: string; task: TaskRecord }): void;
  onTaskQuestion(event: { projectId: string; question: TaskQuestion }): void;
  onApprovalRequested(event: RpcNotificationParams<'broker/approvalRequested'>): void;
  onApprovalResolved(event: RpcNotificationParams<'broker/approvalResolved'>): void;
  onToolCalled(event: RpcNotificationParams<'tool/called'>): void;
  onMcpStateChanged(event: RpcNotificationParams<'mcp/stateChanged'>): void;
  onMcpInputRequired(event: RpcNotificationParams<'mcp/inputRequired'>): void;
  onBoardThreadChanged(event: RpcNotificationParams<'board/threadChanged'>): void;
  onBoardMessagePosted(event: RpcNotificationParams<'board/messagePosted'>): void;
  onBoardDecisionChanged(event: RpcNotificationParams<'board/decisionChanged'>): void;
  onServiceStatus(status: { connected: boolean; message?: string }): void;
}
