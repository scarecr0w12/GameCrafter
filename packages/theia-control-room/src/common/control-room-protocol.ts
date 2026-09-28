import type {
  AccessMode,
  ApprovalRequest,
  EffectiveSetting,
  ProjectCreateInput,
  ProjectSummary,
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
