import { homedir } from 'node:os';
import path from 'node:path';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
  type AccessMode,
  type ApprovalRequest,
  type EffectiveSetting,
  type ExecutionMode,
  type McpConnectionConfig,
  type McpConnectionInput,
  type McpConnectionListEntry,
  type McpConnectionLogEntry,
  type McpConnectionPatch,
  type McpConnectionState,
  type McpToolsResult,
  type Model,
  type ModelCapabilities,
  type ModelPool,
  type ModelPoolTarget,
  type ModelPricing,
  type ProviderAccount,
  type ProviderKind,
  type RouteDecision,
  type RouteOutcome,
  type RoleRecord,
  type SkillActivation,
  type SkillCatalogEntry,
  type SkillEnablement,
  type SkillRecord,
  type ProjectCreateInput,
  type ProjectSkillEntry,
  type ProjectSummary,
  type ServiceInfo,
  type SideEffect,
  type TaskCreateInput,
  type TaskRecord,
  type ToolCallRecord,
  type ToolDefinition,
  type SettingDefinition,
  type SettingGroup,
  type SettingsScope,
} from '@gamecrafter/contracts';
import type { ServiceClient } from '@gamecrafter/service-client';
import type { ControlRoomClient, ControlRoomService } from '../common/control-room-protocol';
import { PlatformServiceConnection } from './service-connection';

@injectable()
export class ControlRoomServiceImpl implements ControlRoomService {
  private client?: ControlRoomClient;
  private removeProjectChangedListener?: () => void;
  private removeSettingsChangedListener?: () => void;
  private removeTaskChangedListener?: () => void;
  private removeTaskQuestionListener?: () => void;
  private removeApprovalRequestedListener?: () => void;
  private removeApprovalResolvedListener?: () => void;
  private removeToolCalledListener?: () => void;
  private removeMcpStateChangedListener?: () => void;
  private removeMcpInputRequiredListener?: () => void;
  private removeServiceStatusListener?: () => void;

  constructor(
    @inject(PlatformServiceConnection)
    private readonly platformConnection: PlatformServiceConnection,
  ) {}

  setClient(client: ControlRoomClient): void {
    this.removeProjectChangedListener?.();
    this.removeSettingsChangedListener?.();
    this.removeTaskChangedListener?.();
    this.removeTaskQuestionListener?.();
    this.removeApprovalRequestedListener?.();
    this.removeApprovalResolvedListener?.();
    this.removeToolCalledListener?.();
    this.removeMcpStateChangedListener?.();
    this.removeMcpInputRequiredListener?.();
    this.removeServiceStatusListener?.();
    this.client = client;
    this.removeProjectChangedListener = this.platformConnection.onProjectChanged((event) => {
      this.client?.onProjectChanged(event);
    });
    this.removeSettingsChangedListener = this.platformConnection.onSettingsChanged((event) => {
      this.client?.onSettingsChanged(event);
    });
    this.removeTaskChangedListener = this.platformConnection.onTaskChanged((event) => {
      this.client?.onTaskChanged(event);
    });
    this.removeTaskQuestionListener = this.platformConnection.onTaskQuestion((event) => {
      this.client?.onTaskQuestion(event);
    });
    this.removeApprovalRequestedListener = this.platformConnection.onApprovalRequested((event) => {
      this.client?.onApprovalRequested(event);
    });
    this.removeApprovalResolvedListener = this.platformConnection.onApprovalResolved((event) => {
      this.client?.onApprovalResolved(event);
    });
    this.removeToolCalledListener = this.platformConnection.onToolCalled((event) => {
      this.client?.onToolCalled(event);
    });
    this.removeMcpStateChangedListener = this.platformConnection.onMcpStateChanged((event) => {
      this.client?.onMcpStateChanged(event);
    });
    this.removeMcpInputRequiredListener = this.platformConnection.onMcpInputRequired((event) => {
      this.client?.onMcpInputRequired(event);
    });
    this.removeServiceStatusListener = this.platformConnection.onServiceStatus((status) => {
      void this.setStatus(status);
    });
    void this.setStatus({ connected: false, message: 'Connecting…' });
  }

  async getServiceInfo(): Promise<ServiceInfo> {
    const client = await this.getPlatformClient();
    const info = await client.call('service/info', {});
    await this.setStatus({
      connected: true,
      message: `Connected to platform service v${info.serviceVersion}`,
    });
    return info;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const client = await this.getPlatformClient();
    return (await client.call('project/list', {})).projects;
  }

  async createProject(input: ProjectCreateInput): Promise<ProjectSummary> {
    const client = await this.getPlatformClient();
    return client.call('project/create', input);
  }

  async openProject(projectPath: string): Promise<ProjectSummary> {
    const client = await this.getPlatformClient();
    return client.call('project/open', { path: projectPath });
  }

  async getDefaultProjectsDirectory(): Promise<string> {
    return path.join(homedir(), 'GameCrafterProjects');
  }

  async describeSettings(): Promise<{ groups: SettingGroup[]; definitions: SettingDefinition[] }> {
    const client = await this.getPlatformClient();
    return client.call('settings/describe', {});
  }

  async getAllSettings(projectId?: string): Promise<EffectiveSetting[]> {
    const client = await this.getPlatformClient();
    const result = await client.call('settings/getAll', {
      projectId,
      sessionId: client.sessionId,
    });
    return result.settings;
  }

  async setSetting(
    key: string,
    scope: SettingsScope,
    value: unknown,
    projectId?: string,
  ): Promise<EffectiveSetting> {
    const client = await this.getPlatformClient();
    return client.call('settings/set', {
      key,
      scope,
      value,
      projectId,
      sessionId: scope === 'session' ? client.sessionId : undefined,
    });
  }

  async listTasks(projectId: string): Promise<TaskRecord[]> {
    const client = await this.getPlatformClient();
    return (await client.call('task/list', { projectId, limit: 200 })).tasks;
  }

  async createTask(input: TaskCreateInput): Promise<{ task: TaskRecord; deduplicated: boolean }> {
    const client = await this.getPlatformClient();
    return client.call('task/create', input);
  }

  async cancelTask(projectId: string, taskId: string, reason?: string): Promise<string[]> {
    const client = await this.getPlatformClient();
    return (await client.call('task/cancel', { projectId, taskId, reason })).cancelled;
  }

  async answerQuestion(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<TaskRecord> {
    const client = await this.getPlatformClient();
    return client.call('task/answer', { projectId, taskId, questionId, answer });
  }

  async listTools(projectId?: string): Promise<ToolDefinition[]> {
    const client = await this.getPlatformClient();
    return (await client.call('tool/list', { projectId })).tools;
  }

  async callTool(
    projectId: string,
    toolId: string,
    input: unknown,
    options: { taskId?: string; agentId?: string; accessCeiling?: AccessMode } = {},
  ): Promise<ToolCallRecord> {
    const client = await this.getPlatformClient();
    return client.call('tool/call', { projectId, toolId, input, ...options });
  }

  async listApprovals(projectId: string, pendingOnly = false): Promise<ApprovalRequest[]> {
    const client = await this.getPlatformClient();
    return (await client.call('broker/approvals', { projectId, pendingOnly })).approvals;
  }

  async approve(
    projectId: string,
    approvalId: string,
    approved: boolean,
    reason?: string,
  ): Promise<ApprovalRequest> {
    const client = await this.getPlatformClient();
    return client.call('broker/approve', { projectId, approvalId, approve: approved, reason });
  }

  async listProviderAccounts(): Promise<ProviderAccount[]> {
    const client = await this.getPlatformClient();
    return (await client.call('provider/accounts', {})).accounts;
  }

  async addProviderAccount(input: {
    providerKind: ProviderKind;
    displayName: string;
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    isLocal?: boolean;
  }): Promise<ProviderAccount> {
    const client = await this.getPlatformClient();
    return client.call('provider/addAccount', input);
  }

  async updateProviderAccount(
    accountId: string,
    patch: {
      displayName?: string;
      baseUrl?: string;
      apiKey?: string | null;
      headers?: Record<string, string>;
      enabled?: boolean;
      isLocal?: boolean;
    },
  ): Promise<ProviderAccount> {
    const client = await this.getPlatformClient();
    return client.call('provider/updateAccount', { accountId, patch });
  }

  async removeProviderAccount(accountId: string): Promise<void> {
    const client = await this.getPlatformClient();
    await client.call('provider/removeAccount', { accountId });
  }

  async testProviderAccount(accountId: string): Promise<{
    ok: boolean;
    latencyMs: number;
    discoveredModels: number;
    error?: string;
  }> {
    const client = await this.getPlatformClient();
    return client.call('provider/testAccount', { accountId });
  }

  async listModels(accountId?: string, enabledOnly?: boolean): Promise<Model[]> {
    const client = await this.getPlatformClient();
    return (await client.call('model/list', { accountId, enabledOnly })).models;
  }

  async discoverModels(
    accountId: string,
  ): Promise<{ added: number; updated: number; models: Model[] }> {
    const client = await this.getPlatformClient();
    return client.call('model/discover', { accountId });
  }

  async updateModel(
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
  ): Promise<Model> {
    const client = await this.getPlatformClient();
    return client.call('model/update', { modelId, patch });
  }

  async listModelPools(projectId?: string): Promise<ModelPool[]> {
    const client = await this.getPlatformClient();
    return (await client.call('pool/list', { projectId })).pools;
  }

  async createModelPool(input: {
    name: string;
    scope: 'platform' | 'project';
    projectId?: string;
    target: ModelPoolTarget | null;
    modelIds: string[];
  }): Promise<ModelPool> {
    const client = await this.getPlatformClient();
    return client.call('pool/create', input);
  }

  async updateModelPool(
    poolId: string,
    patch: {
      name?: string;
      scope?: 'platform' | 'project';
      projectId?: string | null;
      target?: ModelPoolTarget | null;
      modelIds?: string[];
    },
  ): Promise<ModelPool> {
    const client = await this.getPlatformClient();
    return client.call('pool/update', { poolId, patch });
  }

  async deleteModelPool(poolId: string): Promise<void> {
    const client = await this.getPlatformClient();
    await client.call('pool/delete', { poolId });
  }

  async listRouteDecisions(
    projectId?: string,
    limit = 100,
  ): Promise<Array<{ decision: RouteDecision; outcome: RouteOutcome | null }>> {
    const client = await this.getPlatformClient();
    return (await client.call('router/decisions', { projectId, limit })).decisions;
  }

  async routerStats(taskType?: string): Promise<{
    models: Array<{
      modelId: string;
      taskType: string | null;
      observations: number;
      successRate: number;
      qualityMean: number | null;
      meanCostUsd: number | null;
      meanLatencyMs: number | null;
    }>;
  }> {
    const client = await this.getPlatformClient();
    return client.call('router/stats', { taskType });
  }

  async listSkills(projectId?: string): Promise<ProjectSkillEntry[]> {
    const client = await this.getPlatformClient();
    return (await client.call('skills/list', { projectId })).skills;
  }

  async installSkills(source: string, name?: string, force = false): Promise<SkillRecord[]> {
    const client = await this.getPlatformClient();
    return (await client.call('skills/install', { source, name, force })).installed;
  }

  async uninstallSkill(name: string): Promise<void> {
    const client = await this.getPlatformClient();
    await client.call('skills/uninstall', { name });
  }

  async enableSkill(input: {
    projectId: string;
    name: string;
    enabled: boolean;
    roles?: string[] | null;
    workTypes?: string[] | null;
    pin?: boolean;
  }): Promise<SkillEnablement> {
    const client = await this.getPlatformClient();
    return client.call('skills/enable', input);
  }

  async previewSkillCatalog(input: {
    projectId: string;
    agentRole?: string;
    workType?: string;
    taskText?: string;
    accessMode?: AccessMode;
  }): Promise<{ entries: SkillCatalogEntry[]; truncated: boolean }> {
    const client = await this.getPlatformClient();
    return client.call('skills/catalog', input);
  }

  async searchSkills(input: {
    projectId: string;
    query: string;
    agentRole?: string;
    workType?: string;
  }): Promise<{ entries: SkillCatalogEntry[] }> {
    const client = await this.getPlatformClient();
    return client.call('skills/search', input);
  }

  async validateSkill(skillPath: string): Promise<{
    ok: boolean;
    errors: string[];
    warnings: string[];
    record: SkillRecord | null;
  }> {
    const client = await this.getPlatformClient();
    return client.call('skills/validate', { path: skillPath });
  }

  async listSkillActivations(projectId: string, taskId?: string): Promise<SkillActivation[]> {
    const client = await this.getPlatformClient();
    return (await client.call('skills/activations', { projectId, taskId })).activations;
  }

  async listRoles(projectId?: string): Promise<RoleRecord[]> {
    const client = await this.getPlatformClient();
    return (await client.call('roles/list', { projectId })).roles;
  }

  async getRole(name: string, projectId?: string): Promise<RoleRecord> {
    const client = await this.getPlatformClient();
    return client.call('roles/get', { name, projectId });
  }

  async trustProject(projectId: string, trusted: boolean): Promise<ProjectSummary> {
    const client = await this.getPlatformClient();
    return client.call('project/trust', { projectId, trusted });
  }

  async listMcpConnections(projectId?: string): Promise<McpConnectionListEntry[]> {
    const client = await this.getPlatformClient();
    return (await client.call('mcp/list', { projectId })).connections;
  }

  async addMcpConnection(
    config: McpConnectionInput,
    credentials?: Record<string, string>,
  ): Promise<McpConnectionConfig> {
    const client = await this.getPlatformClient();
    return client.call('mcp/add', { config, ...(credentials ? { credentials } : {}) });
  }

  async updateMcpConnection(
    connectionId: string,
    patch: McpConnectionPatch,
    credentials?: Record<string, string>,
  ): Promise<McpConnectionConfig> {
    const client = await this.getPlatformClient();
    return client.call('mcp/update', {
      connectionId,
      patch,
      ...(credentials ? { credentials } : {}),
    });
  }

  async removeMcpConnection(connectionId: string): Promise<void> {
    const client = await this.getPlatformClient();
    await client.call('mcp/remove', { connectionId });
  }

  async connectMcpConnection(connectionId: string): Promise<McpConnectionState> {
    const client = await this.getPlatformClient();
    return client.call('mcp/connect', { connectionId });
  }

  async disconnectMcpConnection(connectionId: string): Promise<McpConnectionState> {
    const client = await this.getPlatformClient();
    return client.call('mcp/disconnect', { connectionId });
  }

  async listMcpTools(connectionId: string): Promise<McpToolsResult> {
    const client = await this.getPlatformClient();
    return client.call('mcp/tools', { connectionId });
  }

  async refreshMcpTools(connectionId: string): Promise<McpToolsResult> {
    const client = await this.getPlatformClient();
    return client.call('mcp/refreshTools', { connectionId });
  }

  async answerMcpInput(connectionId: string, requestId: string, responses: unknown): Promise<void> {
    const client = await this.getPlatformClient();
    await client.call('mcp/answer', { connectionId, requestId, responses });
  }

  async classifyMcpTool(
    connectionId: string,
    toolName: string,
    sideEffects?: SideEffect,
    executionMode?: ExecutionMode,
  ): Promise<ToolDefinition> {
    const client = await this.getPlatformClient();
    return (
      await client.call('mcp/classifyTool', {
        connectionId,
        toolName,
        sideEffects,
        executionMode,
      })
    ).tool;
  }

  async listMcpLogs(connectionId: string, limit?: number): Promise<McpConnectionLogEntry[]> {
    const client = await this.getPlatformClient();
    return (await client.call('mcp/log', { connectionId, limit })).entries;
  }

  async stopServiceOnWindowClose(): Promise<void> {
    const client = await this.getPlatformClient();
    const behavior = await client.call('settings/get', {
      key: 'window.closeBehavior',
      sessionId: client.sessionId,
    });
    if (behavior.value === 'stop-and-checkpoint') {
      await client.call('service/stop', { checkpoint: true });
    }
  }

  private async getPlatformClient(): Promise<ServiceClient> {
    try {
      return await this.platformConnection.getClient();
    } catch (error) {
      void this.setStatus({
        connected: false,
        message: `Unavailable: ${errorMessage(error)}`,
      });
      throw error;
    }
  }

  private async setStatus(status: { connected: boolean; message?: string }): Promise<void> {
    this.client?.onServiceStatus(status);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
