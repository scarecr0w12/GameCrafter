import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { injectable } from '@theia/core/shared/inversify';
import { connect, discover, type ServiceClient } from '@gamecrafter/service-client';
import type { RpcNotificationParams } from '@gamecrafter/contracts';

const localRequire = createRequire(__filename);
const CLIENT_NAME = 'GameCrafter Control Room';
const CLIENT_VERSION = '0.1.0';
const RETRY_INTERVAL_MS = 200;
const CONNECTION_TIMEOUT_MS = 10_000;

@injectable()
export class PlatformServiceConnection {
  private client?: ServiceClient;
  private connecting?: Promise<ServiceClient>;
  private readonly projectChangedListeners = new Set<
    (event: RpcNotificationParams<'project/changed'>) => void
  >();
  private readonly settingsChangedListeners = new Set<
    (event: RpcNotificationParams<'settings/changed'>) => void
  >();
  private readonly taskChangedListeners = new Set<
    (event: RpcNotificationParams<'task/changed'>) => void
  >();
  private readonly taskQuestionListeners = new Set<
    (event: RpcNotificationParams<'task/question'>) => void
  >();
  private readonly approvalRequestedListeners = new Set<
    (event: RpcNotificationParams<'broker/approvalRequested'>) => void
  >();
  private readonly approvalResolvedListeners = new Set<
    (event: RpcNotificationParams<'broker/approvalResolved'>) => void
  >();
  private readonly toolCalledListeners = new Set<
    (event: RpcNotificationParams<'tool/called'>) => void
  >();
  private readonly mcpStateChangedListeners = new Set<
    (event: RpcNotificationParams<'mcp/stateChanged'>) => void
  >();
  private readonly mcpInputRequiredListeners = new Set<
    (event: RpcNotificationParams<'mcp/inputRequired'>) => void
  >();
  private readonly boardThreadChangedListeners = new Set<
    (event: RpcNotificationParams<'board/threadChanged'>) => void
  >();
  private readonly boardMessagePostedListeners = new Set<
    (event: RpcNotificationParams<'board/messagePosted'>) => void
  >();
  private readonly boardDecisionChangedListeners = new Set<
    (event: RpcNotificationParams<'board/decisionChanged'>) => void
  >();
  private readonly pluginWorkerChangedListeners = new Set<
    (event: RpcNotificationParams<'plugin/workerChanged'>) => void
  >();
  private readonly pluginChangedListeners = new Set<
    (event: RpcNotificationParams<'plugin/changed'>) => void
  >();
  private readonly engineCapabilitiesChangedListeners = new Set<
    (event: RpcNotificationParams<'engine/capabilitiesChanged'>) => void
  >();
  private readonly engineRunChangedListeners = new Set<
    (event: RpcNotificationParams<'engine/runChanged'>) => void
  >();
  private readonly dccCapabilitiesChangedListeners = new Set<
    (event: RpcNotificationParams<'dcc/capabilitiesChanged'>) => void
  >();
  private readonly dccRunChangedListeners = new Set<
    (event: RpcNotificationParams<'dcc/runChanged'>) => void
  >();
  private readonly assetJobChangedListeners = new Set<
    (event: RpcNotificationParams<'asset/jobChanged'>) => void
  >();
  private readonly backupRunChangedListeners = new Set<
    (event: RpcNotificationParams<'backup/runChanged'>) => void
  >();
  private readonly knowledgeIndexChangedListeners = new Set<
    (event: RpcNotificationParams<'knowledge/indexChanged'>) => void
  >();
  private readonly knowledgeRecordChangedListeners = new Set<
    (event: RpcNotificationParams<'knowledge/recordChanged'>) => void
  >();
  private readonly changeLockChangedListeners = new Set<
    (event: RpcNotificationParams<'change/lockChanged'>) => void
  >();
  private readonly changeIntegrationChangedListeners = new Set<
    (event: RpcNotificationParams<'change/integrationChanged'>) => void
  >();
  private readonly changeRequestChangedListeners = new Set<
    (event: RpcNotificationParams<'change/requestChanged'>) => void
  >();
  private readonly statusListeners = new Set<
    (status: { connected: boolean; message?: string }) => void
  >();

  getClient(): Promise<ServiceClient> {
    if (this.client) return Promise.resolve(this.client);
    if (!this.connecting) {
      this.connecting = this.connectOrStart().finally(() => {
        this.connecting = undefined;
      });
    }
    return this.connecting;
  }

  onProjectChanged(
    listener: (event: RpcNotificationParams<'project/changed'>) => void,
  ): () => void {
    this.projectChangedListeners.add(listener);
    return () => this.projectChangedListeners.delete(listener);
  }

  onSettingsChanged(
    listener: (event: RpcNotificationParams<'settings/changed'>) => void,
  ): () => void {
    this.settingsChangedListeners.add(listener);
    return () => this.settingsChangedListeners.delete(listener);
  }

  onTaskChanged(listener: (event: RpcNotificationParams<'task/changed'>) => void): () => void {
    this.taskChangedListeners.add(listener);
    return () => this.taskChangedListeners.delete(listener);
  }

  onTaskQuestion(listener: (event: RpcNotificationParams<'task/question'>) => void): () => void {
    this.taskQuestionListeners.add(listener);
    return () => this.taskQuestionListeners.delete(listener);
  }

  onApprovalRequested(
    listener: (event: RpcNotificationParams<'broker/approvalRequested'>) => void,
  ): () => void {
    this.approvalRequestedListeners.add(listener);
    return () => this.approvalRequestedListeners.delete(listener);
  }

  onApprovalResolved(
    listener: (event: RpcNotificationParams<'broker/approvalResolved'>) => void,
  ): () => void {
    this.approvalResolvedListeners.add(listener);
    return () => this.approvalResolvedListeners.delete(listener);
  }

  onToolCalled(listener: (event: RpcNotificationParams<'tool/called'>) => void): () => void {
    this.toolCalledListeners.add(listener);
    return () => this.toolCalledListeners.delete(listener);
  }

  onMcpStateChanged(
    listener: (event: RpcNotificationParams<'mcp/stateChanged'>) => void,
  ): () => void {
    this.mcpStateChangedListeners.add(listener);
    return () => this.mcpStateChangedListeners.delete(listener);
  }

  onMcpInputRequired(
    listener: (event: RpcNotificationParams<'mcp/inputRequired'>) => void,
  ): () => void {
    this.mcpInputRequiredListeners.add(listener);
    return () => this.mcpInputRequiredListeners.delete(listener);
  }

  onBoardThreadChanged(
    listener: (event: RpcNotificationParams<'board/threadChanged'>) => void,
  ): () => void {
    this.boardThreadChangedListeners.add(listener);
    return () => this.boardThreadChangedListeners.delete(listener);
  }

  onBoardMessagePosted(
    listener: (event: RpcNotificationParams<'board/messagePosted'>) => void,
  ): () => void {
    this.boardMessagePostedListeners.add(listener);
    return () => this.boardMessagePostedListeners.delete(listener);
  }

  onBoardDecisionChanged(
    listener: (event: RpcNotificationParams<'board/decisionChanged'>) => void,
  ): () => void {
    this.boardDecisionChangedListeners.add(listener);
    return () => this.boardDecisionChangedListeners.delete(listener);
  }

  onPluginWorkerChanged(
    listener: (event: RpcNotificationParams<'plugin/workerChanged'>) => void,
  ): () => void {
    this.pluginWorkerChangedListeners.add(listener);
    return () => this.pluginWorkerChangedListeners.delete(listener);
  }

  onPluginChanged(listener: (event: RpcNotificationParams<'plugin/changed'>) => void): () => void {
    this.pluginChangedListeners.add(listener);
    return () => this.pluginChangedListeners.delete(listener);
  }

  onEngineCapabilitiesChanged(
    listener: (event: RpcNotificationParams<'engine/capabilitiesChanged'>) => void,
  ): () => void {
    this.engineCapabilitiesChangedListeners.add(listener);
    return () => this.engineCapabilitiesChangedListeners.delete(listener);
  }

  onEngineRunChanged(
    listener: (event: RpcNotificationParams<'engine/runChanged'>) => void,
  ): () => void {
    this.engineRunChangedListeners.add(listener);
    return () => this.engineRunChangedListeners.delete(listener);
  }

  onDccCapabilitiesChanged(
    listener: (event: RpcNotificationParams<'dcc/capabilitiesChanged'>) => void,
  ): () => void {
    this.dccCapabilitiesChangedListeners.add(listener);
    return () => this.dccCapabilitiesChangedListeners.delete(listener);
  }

  onDccRunChanged(listener: (event: RpcNotificationParams<'dcc/runChanged'>) => void): () => void {
    this.dccRunChangedListeners.add(listener);
    return () => this.dccRunChangedListeners.delete(listener);
  }

  onAssetJobChanged(
    listener: (event: RpcNotificationParams<'asset/jobChanged'>) => void,
  ): () => void {
    this.assetJobChangedListeners.add(listener);
    return () => this.assetJobChangedListeners.delete(listener);
  }

  onBackupRunChanged(
    listener: (event: RpcNotificationParams<'backup/runChanged'>) => void,
  ): () => void {
    this.backupRunChangedListeners.add(listener);
    return () => this.backupRunChangedListeners.delete(listener);
  }

  onKnowledgeIndexChanged(
    listener: (event: RpcNotificationParams<'knowledge/indexChanged'>) => void,
  ): () => void {
    this.knowledgeIndexChangedListeners.add(listener);
    return () => this.knowledgeIndexChangedListeners.delete(listener);
  }

  onKnowledgeRecordChanged(
    listener: (event: RpcNotificationParams<'knowledge/recordChanged'>) => void,
  ): () => void {
    this.knowledgeRecordChangedListeners.add(listener);
    return () => this.knowledgeRecordChangedListeners.delete(listener);
  }

  onChangeLockChanged(
    listener: (event: RpcNotificationParams<'change/lockChanged'>) => void,
  ): () => void {
    this.changeLockChangedListeners.add(listener);
    return () => this.changeLockChangedListeners.delete(listener);
  }

  onChangeIntegrationChanged(
    listener: (event: RpcNotificationParams<'change/integrationChanged'>) => void,
  ): () => void {
    this.changeIntegrationChangedListeners.add(listener);
    return () => this.changeIntegrationChangedListeners.delete(listener);
  }

  onChangeRequestChanged(
    listener: (event: RpcNotificationParams<'change/requestChanged'>) => void,
  ): () => void {
    this.changeRequestChangedListeners.add(listener);
    return () => this.changeRequestChangedListeners.delete(listener);
  }

  onServiceStatus(
    listener: (status: { connected: boolean; message?: string }) => void,
  ): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private async connectOrStart(): Promise<ServiceClient> {
    const deadline = Date.now() + CONNECTION_TIMEOUT_MS;
    let serviceStarted = false;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const discovery = await discover();
        const client = await connect({
          ...discovery,
          clientName: CLIENT_NAME,
          clientVersion: CLIENT_VERSION,
        });
        this.client = client;
        this.notifyStatus({ connected: true, message: 'Connected to platform service' });
        client.onNotification('project/changed', (event) => {
          for (const listener of this.projectChangedListeners) listener(event);
        });
        client.onNotification('settings/changed', (event) => {
          for (const listener of this.settingsChangedListeners) listener(event);
        });
        client.onNotification('task/changed', (event) => {
          for (const listener of this.taskChangedListeners) listener(event);
        });
        client.onNotification('task/question', (event) => {
          for (const listener of this.taskQuestionListeners) listener(event);
        });
        client.onNotification('broker/approvalRequested', (event) => {
          for (const listener of this.approvalRequestedListeners) listener(event);
        });
        client.onNotification('broker/approvalResolved', (event) => {
          for (const listener of this.approvalResolvedListeners) listener(event);
        });
        client.onNotification('tool/called', (event) => {
          for (const listener of this.toolCalledListeners) listener(event);
        });
        client.onNotification('mcp/stateChanged', (event) => {
          for (const listener of this.mcpStateChangedListeners) listener(event);
        });
        client.onNotification('mcp/inputRequired', (event) => {
          for (const listener of this.mcpInputRequiredListeners) listener(event);
        });
        client.onNotification('board/threadChanged', (event) => {
          for (const listener of this.boardThreadChangedListeners) listener(event);
        });
        client.onNotification('board/messagePosted', (event) => {
          for (const listener of this.boardMessagePostedListeners) listener(event);
        });
        client.onNotification('board/decisionChanged', (event) => {
          for (const listener of this.boardDecisionChangedListeners) listener(event);
        });
        client.onNotification('plugin/workerChanged', (event) => {
          for (const listener of this.pluginWorkerChangedListeners) listener(event);
        });
        client.onNotification('plugin/changed', (event) => {
          for (const listener of this.pluginChangedListeners) listener(event);
        });
        client.onNotification('engine/capabilitiesChanged', (event) => {
          for (const listener of this.engineCapabilitiesChangedListeners) listener(event);
        });
        client.onNotification('engine/runChanged', (event) => {
          for (const listener of this.engineRunChangedListeners) listener(event);
        });
        client.onNotification('dcc/capabilitiesChanged', (event) => {
          for (const listener of this.dccCapabilitiesChangedListeners) listener(event);
        });
        client.onNotification('dcc/runChanged', (event) => {
          for (const listener of this.dccRunChangedListeners) listener(event);
        });
        client.onNotification('asset/jobChanged', (event) => {
          for (const listener of this.assetJobChangedListeners) listener(event);
        });
        client.onNotification('backup/runChanged', (event) => {
          for (const listener of this.backupRunChangedListeners) listener(event);
        });
        client.onNotification('knowledge/indexChanged', (event) => {
          for (const listener of this.knowledgeIndexChangedListeners) listener(event);
        });
        client.onNotification('knowledge/recordChanged', (event) => {
          for (const listener of this.knowledgeRecordChangedListeners) listener(event);
        });
        client.onNotification('change/lockChanged', (event) => {
          for (const listener of this.changeLockChangedListeners) listener(event);
        });
        client.onNotification('change/integrationChanged', (event) => {
          for (const listener of this.changeIntegrationChangedListeners) listener(event);
        });
        client.onNotification('change/requestChanged', (event) => {
          for (const listener of this.changeRequestChangedListeners) listener(event);
        });
        client.onClose(() => {
          if (this.client === client) {
            this.client = undefined;
            this.notifyStatus({
              connected: false,
              message: 'Unavailable: platform service disconnected',
            });
          }
        });
        return client;
      } catch (error) {
        lastError = error;
        if (!isUnavailable(error)) throw error;
        if (!serviceStarted) {
          this.startService();
          serviceStarted = true;
        }
        await delay(RETRY_INTERVAL_MS);
      }
    }

    const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
    throw new Error(`Platform service did not become available within 10 seconds${detail}`);
  }

  private notifyStatus(status: { connected: boolean; message?: string }): void {
    for (const listener of this.statusListeners) listener(status);
  }

  private startService(): void {
    const child = spawn(process.execPath, [resolvePlatformServiceCli(), 'start'], {
      detached: true,
      stdio: 'ignore',
      env: createPlatformServiceEnvironment(process.env),
    });
    child.unref();
  }
}

export function resolvePlatformServiceCli(): string {
  const servicePackage = localRequire.resolve('@gamecrafter/platform-service/package.json');
  return path.join(path.dirname(servicePackage), 'lib', 'cli.js');
}

export function createPlatformServiceEnvironment(inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...inherited, ELECTRON_RUN_AS_NODE: '1' };
}

function isUnavailable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ECONNREFUSED' || error.code === 'ENOENT')
  );
}
