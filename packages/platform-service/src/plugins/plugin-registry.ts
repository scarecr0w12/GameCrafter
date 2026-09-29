import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  type PluginModulesResult,
  type PluginRecordTypeContribution,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ProfileStore } from '../profile/profile-store';
import type { PluginInstaller } from './plugin-installer';

interface PluginEnablementRow {
  enabled: number;
}

export interface PluginContributionDirectory {
  pluginId: string;
  directory: string;
}

export interface PluginRegistryOptions {
  database: Database;
  profile: ProfileStore;
  installer: PluginInstaller;
}

export class PluginRegistry {
  constructor(private readonly options: PluginRegistryOptions) {}

  list(projectId?: string) {
    if (projectId && !this.options.profile.getById(projectId)) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    return this.options.installer.list().map((installed) => ({
      installed,
      projectEnabled: projectId ? this.isProjectEnabled(installed.pluginId, projectId) : null,
      worker: null,
    }));
  }

  setPlatformEnabled(pluginId: string, enabled: boolean): void {
    this.options.installer.setEnabled(pluginId, enabled);
  }

  setProjectEnabled(projectId: string, pluginId: string, enabled: boolean): void {
    if (!this.options.profile.getById(projectId)) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    this.requirePlugin(pluginId);
    this.options.database
      .prepare(
        `INSERT INTO plugin_project_enablement (project_id, plugin_id, enabled)
         VALUES (?, ?, ?)
         ON CONFLICT(project_id, plugin_id) DO UPDATE SET enabled = excluded.enabled`,
      )
      .run(projectId, pluginId, enabled ? 1 : 0);
  }

  isProjectEnabled(pluginId: string, projectId: string): boolean {
    const row = this.options.database
      .prepare(
        'SELECT enabled FROM plugin_project_enablement WHERE project_id = ? AND plugin_id = ?',
      )
      .get<PluginEnablementRow>(projectId, pluginId);
    return row?.enabled === 1;
  }

  isEnabledForProject(pluginId: string, projectId: string): boolean {
    return this.requirePlugin(pluginId).enabled && this.isProjectEnabled(pluginId, projectId);
  }

  enabledPlugins(projectId?: string) {
    return this.options.installer
      .list()
      .filter((plugin) =>
        projectId ? this.isEnabledForProject(plugin.pluginId, projectId) : plugin.enabled,
      );
  }

  roleDirectories(projectId?: string): PluginContributionDirectory[] {
    return this.enabledPlugins(projectId).flatMap((plugin) =>
      plugin.manifest.contributes.roles.map((relative) => ({
        pluginId: plugin.pluginId,
        directory: path.join(plugin.installPath, relative),
      })),
    );
  }

  skillDirectories(projectId: string): PluginContributionDirectory[] {
    return this.enabledPlugins(projectId).flatMap((plugin) =>
      plugin.manifest.contributes.skills.map((relative) => ({
        pluginId: plugin.pluginId,
        directory: path.join(plugin.installPath, relative),
      })),
    );
  }

  recordTypes(): Array<{ pluginId: string; recordType: PluginRecordTypeContribution }> {
    return this.options.installer.list().flatMap((plugin) =>
      (plugin.manifest.contributes.recordTypes ?? []).map((recordType) => ({
        pluginId: plugin.pluginId,
        recordType,
      })),
    );
  }

  modules(): PluginModulesResult {
    const installed = this.options.installer.list();
    const modules = installed.flatMap((plugin) =>
      plugin.manifest.contributes.modules.map((module) => ({
        pluginId: plugin.pluginId,
        active: plugin.enabled,
        module,
      })),
    );
    const genres = installed.flatMap((plugin) =>
      plugin.manifest.contributes.genres.map((genre) => ({
        pluginId: plugin.pluginId,
        active: plugin.enabled,
        genre,
      })),
    );
    const conflicts = [
      ...collectConflicts(
        modules
          .filter((entry) => entry.active)
          .map((entry) => ({
            id: entry.module.id,
            pluginId: entry.pluginId,
          })),
      ),
      ...collectConflicts(
        genres
          .filter((entry) => entry.active)
          .map((entry) => ({
            id: entry.genre.id,
            pluginId: entry.pluginId,
          })),
      ),
    ].sort((left, right) => left.id.localeCompare(right.id));
    return {
      modules: modules.sort(
        (left, right) =>
          left.module.id.localeCompare(right.module.id) ||
          left.pluginId.localeCompare(right.pluginId),
      ),
      genres: genres.sort(
        (left, right) =>
          left.genre.id.localeCompare(right.genre.id) ||
          left.pluginId.localeCompare(right.pluginId),
      ),
      conflicts,
    };
  }

  private requirePlugin(pluginId: string) {
    const installed = this.options.installer.get(pluginId);
    if (!installed)
      throw new RpcError(`Plugin not found: ${pluginId}`, RpcErrorCode.PluginNotFound);
    return installed;
  }
}

function collectConflicts(entries: Array<{ id: string; pluginId: string }>) {
  const pluginIds = new Map<string, Set<string>>();
  for (const entry of entries) {
    const plugins = pluginIds.get(entry.id) ?? new Set<string>();
    plugins.add(entry.pluginId);
    pluginIds.set(entry.id, plugins);
  }
  return [...pluginIds.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([id, ids]) => ({ id, pluginIds: [...ids].sort() }));
}
