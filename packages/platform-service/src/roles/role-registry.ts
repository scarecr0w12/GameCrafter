import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { RpcError, RpcErrorCode, type RoleRecord } from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import { loadRoleDir } from './role-loader';

export interface PluginRoleDirectory {
  pluginId: string;
  directory: string;
}

interface RoleRegistryOptions {
  profile: ProfileStore;
  profileDir: string;
  builtinRolesDir?: string;
  pluginRoleDirectories?: (projectId?: string) => PluginRoleDirectory[];
}

export class RoleRegistry {
  private readonly builtinRolesDir: string;

  constructor(private readonly options: RoleRegistryOptions) {
    this.builtinRolesDir = options.builtinRolesDir ?? findBuiltinRolesDirectory();
  }

  list(projectId?: string): RoleRecord[] {
    const roles = new Map<string, RoleRecord>();
    for (const role of loadRoleRoot(this.builtinRolesDir, 'builtin')) roles.set(role.name, role);
    for (const plugin of this.options.pluginRoleDirectories?.(projectId) ?? []) {
      const role = loadRoleDir(plugin.directory, 'platform', 'plugin');
      roles.set(role.name, role);
    }
    for (const role of loadRoleRoot(path.join(this.options.profileDir, 'roles'), 'platform')) {
      roles.set(role.name, role);
    }
    if (projectId) {
      const project = this.options.profile.getById(projectId);
      if (!project)
        throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
      for (const role of loadRoleRoot(
        path.join(project.path, '.gamecrafter', 'roles'),
        'project',
      )) {
        roles.set(role.name, role);
      }
    }
    return [...roles.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  get(name: string, projectId?: string): RoleRecord {
    const role = this.list(projectId).find((candidate) => candidate.name === name);
    if (!role) throw new RpcError(`Role not found: ${name}`, RpcErrorCode.RoleNotFound);
    return role;
  }
}

function findBuiltinRolesDirectory(): string {
  const candidates = [
    __dirname,
    path.join(__dirname, 'roles'),
    path.resolve(__dirname, '../../roles'),
  ];
  return (
    candidates.find((candidate) => existsSync(path.join(candidate, 'coordinator', 'ROLE.md'))) ??
    candidates[0]!
  );
}

function loadRoleRoot(root: string, scope: RoleRecord['scope']): RoleRecord[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => path.join(root, entry.name))
    .filter((directory) => existsSync(path.join(directory, 'ROLE.md')))
    .sort()
    .map((directory) => loadRoleDir(directory, scope));
}
