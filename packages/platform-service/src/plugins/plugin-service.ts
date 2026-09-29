import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  compile,
  DeclarativePanelSchema,
  RpcError,
  RpcErrorCode,
  type DeclarativePanel,
  type RpcNotificationParams,
  type InstalledPlugin,
  type PluginInspection,
  type PluginListEntry,
  type PluginLogEntry,
  type PluginWorkerState,
} from '@gamecrafter/contracts';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { SettingsRegistry } from '../settings/registry';
import type { SettingsService } from '../settings/settings-service';
import { PluginHost } from './plugin-host';
import { PluginInstaller } from './plugin-installer';
import { PluginRegistry } from './plugin-registry';

const panelValidator = compile<DeclarativePanel>(DeclarativePanelSchema);

export interface PluginServiceOptions {
  installer: PluginInstaller;
  registry: PluginRegistry;
  host: PluginHost;
  profile: ProfileStore;
  settingsRegistry: SettingsRegistry;
  settings: SettingsService;
  credentials: CredentialStore;
  onChanged?: (pluginId: string) => void;
}

export class PluginService {
  private readonly registeredSettingsSources = new Set<string>();

  constructor(private readonly options: PluginServiceOptions) {
    this.registerInstalledSettings();
  }

  list(projectId?: string): PluginListEntry[] {
    return this.options.registry.list(projectId).map((entry) => ({
      ...entry,
      worker: this.options.host.workerState(entry.installed.pluginId, projectId),
    }));
  }

  inspect(source: string): Promise<PluginInspection> {
    return this.options.installer.inspect(source);
  }

  async install(
    source: string,
    acceptCapabilities: PluginInspection['capabilities'],
  ): Promise<InstalledPlugin> {
    const installed = await this.options.installer.install(source, acceptCapabilities);
    const settingsSource = `plugin:${installed.pluginId}`;
    if (!this.registeredSettingsSources.has(settingsSource)) {
      try {
        this.options.settingsRegistry.register(
          settingsSource,
          [],
          installed.manifest.contributes.settings,
        );
        this.registeredSettingsSources.add(settingsSource);
      } catch (error) {
        this.options.installer.uninstall(installed.pluginId);
        throw error;
      }
    }
    this.options.onChanged?.(installed.pluginId);
    return installed;
  }

  async uninstall(pluginId: string): Promise<{ removed: true }> {
    this.requirePlugin(pluginId);
    await this.options.host.stopPlugin(pluginId);
    const source = `plugin:${pluginId}`;
    this.options.settings.unregisterSource(
      source,
      this.options.profile.list().map((project) => project.projectId),
    );
    this.registeredSettingsSources.delete(source);
    this.options.credentials.deletePrefix(`plugin:${pluginId}:`);
    this.options.installer.uninstall(pluginId);
    this.options.onChanged?.(pluginId);
    return { removed: true };
  }

  async enable(pluginId: string, projectId?: string): Promise<{ enabled: true }> {
    if (projectId) this.options.registry.setProjectEnabled(projectId, pluginId, true);
    else this.options.registry.setPlatformEnabled(pluginId, true);
    this.options.onChanged?.(pluginId);
    return { enabled: true };
  }

  async disable(pluginId: string, projectId?: string): Promise<{ enabled: false }> {
    this.requirePlugin(pluginId);
    if (projectId) {
      this.options.registry.setProjectEnabled(projectId, pluginId, false);
      await this.options.host.stop(pluginId, projectId);
    } else {
      this.options.registry.setPlatformEnabled(pluginId, false);
      await this.options.host.stopPlugin(pluginId);
    }
    this.options.onChanged?.(pluginId);
    return { enabled: false };
  }

  start(pluginId: string, projectId: string): Promise<PluginWorkerState> {
    this.requirePlugin(pluginId);
    return this.options.host.start(pluginId, projectId);
  }

  stop(pluginId: string, projectId: string): Promise<PluginWorkerState> {
    this.requirePlugin(pluginId);
    return this.options.host.stop(pluginId, projectId);
  }

  status(pluginId: string, projectId?: string): PluginWorkerState {
    this.requirePlugin(pluginId);
    return this.options.host.status(pluginId, projectId);
  }

  isolationReport() {
    return this.options.host.isolationReport();
  }

  logs(pluginId: string, projectId?: string, limit = 100): { entries: PluginLogEntry[] } {
    this.requirePlugin(pluginId);
    return { entries: this.options.host.logsFor(pluginId, projectId, limit) };
  }

  setSecret(pluginId: string, name: string, value: string): { stored: true } {
    this.requirePlugin(pluginId);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) {
      throw new RpcError('Plugin secret name is invalid.', RpcErrorCode.InvalidParams);
    }
    this.options.credentials.put(`plugin:${pluginId}:${name}`, value);
    this.options.host.rememberSecret(pluginId, name, value);
    return { stored: true };
  }

  panel(pluginId: string, panelId: string): DeclarativePanel {
    const plugin = this.requirePlugin(pluginId);
    const contribution = plugin.manifest.contributes.ui.panels.find(
      (panel) => panel.id === panelId,
    );
    if (!contribution) {
      throw new RpcError(`Plugin panel not found: ${panelId}`, RpcErrorCode.PluginNotFound);
    }
    const panelPath = path.resolve(plugin.installPath, contribution.source);
    if (!isWithin(panelPath, plugin.installPath)) {
      throw new RpcError(
        'Plugin panel path escapes its installation.',
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    let panel: unknown;
    try {
      assertRegularPluginFile(plugin.installPath, panelPath);
      panel = JSON.parse(readFileSync(panelPath, 'utf8')) as unknown;
      panel = panelValidator.assert(panel);
    } catch (error) {
      throw new RpcError(
        `Plugin panel is invalid: ${error instanceof Error ? error.message : String(error)}`,
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    const declaredTools = new Set(plugin.manifest.contributes.tools.map((tool) => tool.toolId));
    for (const section of (panel as DeclarativePanel).sections) {
      if (section.kind !== 'markdown' && !declaredTools.has(section.toolId)) {
        throw new RpcError(
          `Plugin panel references an undeclared tool: ${section.toolId}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
    }
    return panel as DeclarativePanel;
  }

  modules() {
    return this.options.registry.modules();
  }

  async autoStartProject(projectId: string): Promise<void> {
    if (this.options.settings.resolve('plugins.autoStart', { projectId }).value !== true) return;
    for (const plugin of this.options.registry.enabledPlugins(projectId)) {
      await this.options.host.start(plugin.pluginId, projectId).catch(() => undefined);
    }
  }

  async autoStartRegisteredProjects(): Promise<void> {
    for (const project of this.options.profile.list()) {
      if (project.lastOpenedAt) await this.autoStartProject(project.projectId);
    }
  }

  async settingsChanged(event: RpcNotificationParams<'settings/changed'>): Promise<void> {
    if (event.scope === 'session') return;
    const plugin = this.options.installer
      .list()
      .find((candidate) => event.key.startsWith(`plugin.${candidate.pluginId}.`));
    if (!plugin) return;
    const projectIds = event.projectId
      ? [event.projectId]
      : this.options.host
          .listStates(plugin.pluginId)
          .map((state) => state.projectId)
          .filter((projectId): projectId is string => projectId !== null);
    const prefix = `plugin.${plugin.pluginId}.`;
    await Promise.all(
      projectIds.map(async (projectId) => {
        const settings = Object.fromEntries(
          this.options.settings
            .getAll({ projectId })
            .filter((setting) => setting.key.startsWith(prefix))
            .map((setting) => [setting.key, setting.value]),
        );
        await this.options.host.settingsChanged(plugin.pluginId, projectId, settings);
      }),
    );
  }

  private registerInstalledSettings(): void {
    for (const plugin of this.options.installer.list()) {
      const source = `plugin:${plugin.pluginId}`;
      this.options.settingsRegistry.register(source, [], plugin.manifest.contributes.settings);
      this.registeredSettingsSources.add(source);
    }
  }

  private requirePlugin(pluginId: string) {
    const plugin = this.options.installer.get(pluginId);
    if (!plugin) throw new RpcError(`Plugin not found: ${pluginId}`, RpcErrorCode.PluginNotFound);
    return plugin;
  }
}

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertRegularPluginFile(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  let current = path.resolve(root);
  const parts = relative.split(path.sep);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('Panel path contains a symbolic link.');
    if (index === parts.length - 1) {
      if (!stat.isFile() || stat.size > 1024 * 1024) {
        throw new Error('Panel file must be a regular file smaller than one mebibyte.');
      }
    } else if (!stat.isDirectory()) {
      throw new Error('Panel path contains a non-directory component.');
    }
  }
}
