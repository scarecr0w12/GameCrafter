import { homedir } from 'node:os';
import path from 'node:path';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
  type EffectiveSetting,
  type ProjectCreateInput,
  type ProjectSummary,
  type ServiceInfo,
  type TaskCreateInput,
  type TaskRecord,
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
