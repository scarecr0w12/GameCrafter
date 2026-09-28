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
    const servicePackage = localRequire.resolve('@gamecrafter/platform-service/package.json');
    const cli = path.join(path.dirname(servicePackage), 'lib', 'cli.js');
    const child = spawn(process.execPath, [cli, 'start'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();
  }
}

function isUnavailable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ECONNREFUSED' || error.code === 'ENOENT')
  );
}
