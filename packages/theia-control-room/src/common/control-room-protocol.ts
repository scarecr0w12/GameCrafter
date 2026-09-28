import type {
  AccessMode,
  ApprovalRequest,
  EffectiveSetting,
  Model,
  ModelCapabilities,
  ModelPool,
  ModelPoolTarget,
  ModelPricing,
  ProjectCreateInput,
  ProjectSummary,
  ProviderAccount,
  ProviderKind,
  RouteDecision,
  RouteOutcome,
  RpcNotificationParams,
  ServiceInfo,
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
}

export interface ControlRoomClient {
  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void;
  onSettingsChanged(event: RpcNotificationParams<'settings/changed'>): void;
  onTaskChanged(event: { projectId: string; task: TaskRecord }): void;
  onTaskQuestion(event: { projectId: string; question: TaskQuestion }): void;
  onApprovalRequested(event: RpcNotificationParams<'broker/approvalRequested'>): void;
  onApprovalResolved(event: RpcNotificationParams<'broker/approvalResolved'>): void;
  onToolCalled(event: RpcNotificationParams<'tool/called'>): void;
  onServiceStatus(status: { connected: boolean; message?: string }): void;
}
