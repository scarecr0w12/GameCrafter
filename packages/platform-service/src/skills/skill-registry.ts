import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  type ProjectSkillEntry,
  type SkillActivation,
  type SkillActivationResult,
  type SkillEnablement,
  type SkillRecord,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import { SkillInstaller } from './skill-installer';
import { loadSkillDir, stripFrontmatter } from './skill-loader';
import { BUNDLED_SKILL_NAMES } from './bundled-skill-names';

type SettingsReader = Pick<SettingsService, 'resolve'>;

interface SkillEnablementRow {
  name: string;
  enabled: number;
  pinnedVersion: string | null;
  pinnedHash: string | null;
  rolesJson: string | null;
  workTypesJson: string | null;
}

interface SkillActivationRow {
  activationId: string;
  name: string;
  version: string | null;
  hash: string;
  taskId: string | null;
  agentId: string | null;
  activatedAt: string;
}

export interface PluginSkillDirectory {
  pluginId: string;
  directory: string;
}

interface RegistryOptions {
  profile: ProfileStore;
  projectDatabases: ProjectDatabases;
  installer: SkillInstaller;
  settings: SettingsReader;
  homeDir?: string;
  bundledSkillsDirectory?: string;
  now?: () => Date;
  pluginSkillDirectories?: (projectId: string) => PluginSkillDirectory[];
}

const enablementColumns = `name, enabled, pinned_version AS pinnedVersion, pinned_hash AS pinnedHash,
  roles AS rolesJson, work_types AS workTypesJson`;
const activationColumns = `activation_id AS activationId, name, version, hash,
  task_id AS taskId, agent_id AS agentId, activated_at AS activatedAt`;

export interface SkillEnableInput {
  name: string;
  enabled: boolean;
  roles?: string[] | null;
  workTypes?: string[] | null;
  pin?: boolean;
}

export class SkillRegistry {
  private readonly homeDir: string;
  private readonly now: () => Date;
  private readonly shadowedEvents = new Set<string>();

  constructor(private readonly options: RegistryOptions) {
    this.homeDir = options.homeDir ?? os.homedir();
    this.now = options.now ?? (() => new Date());
  }

  listPlatform(): ProjectSkillEntry[] {
    return [...this.options.installer.listInstalledRecords(), ...this.bundledRecords()].map(
      (record) => ({
        ...record,
        enablement: null,
        shadowedBy: null,
      }),
    );
  }

  listForProject(projectId: string): ProjectSkillEntry[] {
    const project = this.options.profile.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const database = this.options.projectDatabases.get(projectId);
    const enablements = this.loadEnablements(database);
    const platformSkills = this.options.installer.listInstalledRecords().map((record) => ({
      ...record,
      enablement: enablements.get(record.name) ?? emptyEnablement(record.name),
      shadowedBy: null as string | null,
    }));
    const bundledSkills = this.bundledRecords().map((record) => ({
      ...record,
      enablement: enablements.get(record.name) ?? {
        ...emptyEnablement(record.name),
        enabled: true,
      },
      shadowedBy: null as string | null,
    }));
    const pluginSkills = (this.options.pluginSkillDirectories?.(projectId) ?? []).flatMap(
      ({ pluginId, directory }) => {
        try {
          const record = loadSkillDir(directory, 'platform', `plugin:${pluginId}`);
          return [
            {
              ...record,
              enablement: {
                name: record.name,
                enabled: true,
                pinnedVersion: null,
                pinnedHash: null,
                roles: null,
                workTypes: null,
              },
              shadowedBy: null,
            },
          ];
        } catch {
          return [];
        }
      },
    );
    const localRoot = path.join(project.path, '.agents', 'skills');
    const projectSkills = scanSkillRoot(localRoot, 'project', project.trusted).map((record) => ({
      ...record,
      enablement: null,
      shadowedBy: null as string | null,
    }));
    const compatibilityEnabled = Boolean(
      this.options.settings.resolve('skills.compatibilityScan.enabled', { projectId }).value,
    );
    const compatibilityRoots = compatibilityEnabled
      ? [
          path.join(project.path, '.claude', 'skills'),
          path.join(this.homeDir, '.agents', 'skills'),
          path.join(this.homeDir, '.claude', 'skills'),
        ]
      : [];
    const compatibilitySkills = compatibilityRoots.flatMap((root) =>
      scanSkillRoot(root, 'compat', project.trusted).map((record) => ({
        ...record,
        enablement: null,
        shadowedBy: null as string | null,
      })),
    );
    const entries: ProjectSkillEntry[] = [
      ...projectSkills,
      ...platformSkills,
      ...pluginSkills,
      ...bundledSkills,
      ...compatibilitySkills,
    ];
    this.applyShadowing(projectId, entries);
    return entries.sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        scopeRank(left) - scopeRank(right) ||
        left.location.localeCompare(right.location),
    );
  }

  enable(projectId: string, input: SkillEnableInput): SkillEnablement {
    const record = [
      ...this.options.installer.listInstalledRecords(),
      ...this.bundledRecords(),
    ].find((skill) => skill.name === input.name);
    if (!record) {
      throw new RpcError(
        `Installed platform skill not found: ${input.name}`,
        RpcErrorCode.SkillNotFound,
      );
    }
    const database = this.options.projectDatabases.get(projectId);
    const current = database
      .prepare(`SELECT ${enablementColumns} FROM skill_enablement WHERE name = ?`)
      .get<SkillEnablementRow>(input.name);
    const pinnedVersion =
      input.pin === true
        ? record.version
        : input.pin === false
          ? null
          : (current?.pinnedVersion ?? null);
    const pinnedHash =
      input.pin === true ? record.hash : input.pin === false ? null : (current?.pinnedHash ?? null);
    const roles = input.roles === undefined ? parseList(current?.rolesJson) : input.roles;
    const workTypes =
      input.workTypes === undefined ? parseList(current?.workTypesJson) : input.workTypes;
    const enablement: SkillEnablement = {
      name: input.name,
      enabled: input.enabled,
      pinnedVersion,
      pinnedHash,
      roles,
      workTypes,
    };
    database
      .prepare(
        `INSERT INTO skill_enablement (name, enabled, pinned_version, pinned_hash, roles, work_types)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           enabled = excluded.enabled,
           pinned_version = excluded.pinned_version,
           pinned_hash = excluded.pinned_hash,
           roles = excluded.roles,
           work_types = excluded.work_types`,
      )
      .run(
        enablement.name,
        Number(enablement.enabled),
        enablement.pinnedVersion,
        enablement.pinnedHash,
        enablement.roles === null ? null : JSON.stringify(enablement.roles),
        enablement.workTypes === null ? null : JSON.stringify(enablement.workTypes),
      );
    return enablement;
  }

  activate(
    projectId: string,
    name: string,
    taskId?: string,
    agentId?: string,
    modelId: string | null = null,
  ): SkillActivationResult {
    const entry = this.activatableSkill(projectId, name);
    const database = this.options.projectDatabases.get(projectId);
    if (taskId) {
      const existing = database
        .prepare(
          `SELECT ${activationColumns} FROM skill_activations
           WHERE name = ? AND task_id = ? ORDER BY activated_at LIMIT 1`,
        )
        .get<SkillActivationRow>(name, taskId);
      if (existing) {
        return {
          content: `Skill "${name}" is already loaded in this task.`,
          version: entry.version,
          dir: entry.location,
          resources: entry.resources,
          alreadyActive: true,
        };
      }
    }

    const skillPath = path.join(entry.location, 'SKILL.md');
    const body = stripFrontmatter(readFileSync(skillPath, 'utf8'));
    const content = wrapSkillContent(entry, body);
    const activationId = uuidv7();
    const activatedAt = this.now().toISOString();
    database
      .prepare(
        `INSERT INTO skill_activations
          (activation_id, name, version, hash, task_id, agent_id, model_id, activated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        activationId,
        name,
        entry.version,
        entry.hash,
        taskId ?? null,
        agentId ?? null,
        modelId,
        activatedAt,
      );
    return {
      content,
      version: entry.version,
      dir: entry.location,
      resources: entry.resources,
      alreadyActive: false,
    };
  }

  activations(projectId: string, taskId?: string): SkillActivation[] {
    const database = this.options.projectDatabases.get(projectId);
    const rows = taskId
      ? database
          .prepare(
            `SELECT ${activationColumns} FROM skill_activations WHERE task_id = ? ORDER BY activated_at`,
          )
          .all<SkillActivationRow>(taskId)
      : database
          .prepare(`SELECT ${activationColumns} FROM skill_activations ORDER BY activated_at`)
          .all<SkillActivationRow>();
    return rows.map((row) => ({ ...row }));
  }

  readableSkillRoots(projectId: string): string[] {
    const project = this.options.profile.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const roots = [
      this.options.installer.skillsDirectory,
      ...(this.options.bundledSkillsDirectory
        ? BUNDLED_SKILL_NAMES.map((name) => path.join(this.options.bundledSkillsDirectory!, name))
        : []),
      ...(this.options.pluginSkillDirectories?.(projectId) ?? []).map((plugin) => plugin.directory),
    ];
    if (
      project.trusted &&
      this.options.settings.resolve('skills.compatibilityScan.enabled', { projectId }).value
    ) {
      roots.push(
        path.join(this.homeDir, '.agents', 'skills'),
        path.join(this.homeDir, '.claude', 'skills'),
      );
    }
    return roots;
  }

  activatableSkill(projectId: string, name: string): SkillRecord {
    const project = this.options.profile.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const entries = this.listForProject(projectId).filter((entry) => entry.name === name);
    const projectOrCompat = entries.find((entry) => entry.scope !== 'platform');
    if (!project.trusted && projectOrCompat) {
      throw new RpcError(
        `Project ${projectId} is not trusted; local and compatibility skills cannot be activated.`,
        RpcErrorCode.ProjectUntrusted,
      );
    }
    const entry = entries.find((candidate) => candidate.shadowedBy === null);
    if (!entry) throw new RpcError(`Skill not found: ${name}`, RpcErrorCode.SkillNotFound);
    if (entry.scope === 'platform' && !entry.enablement?.enabled) {
      throw new RpcError(`Skill is disabled in this Project: ${name}`, RpcErrorCode.SkillNotFound);
    }
    if (
      entry.scope === 'platform' &&
      ((entry.enablement?.pinnedVersion && entry.enablement.pinnedVersion !== entry.version) ||
        (entry.enablement?.pinnedHash && entry.enablement.pinnedHash !== entry.hash))
    ) {
      throw new RpcError(
        `Installed skill no longer matches its pinned version: ${name}`,
        RpcErrorCode.SkillInvalid,
      );
    }
    return entry;
  }

  private bundledRecords(): SkillRecord[] {
    const directory = this.options.bundledSkillsDirectory;
    if (!directory) return [];
    return BUNDLED_SKILL_NAMES.map((name) =>
      loadSkillDir(path.join(directory, name), 'platform', 'builtin:gamecrafter'),
    );
  }

  private loadEnablements(database: Database): Map<string, SkillEnablement> {
    const rows = database
      .prepare(`SELECT ${enablementColumns} FROM skill_enablement ORDER BY name`)
      .all<SkillEnablementRow>();
    return new Map(
      rows.map((row) => [
        row.name,
        {
          name: row.name,
          enabled: row.enabled === 1,
          pinnedVersion: row.pinnedVersion,
          pinnedHash: row.pinnedHash,
          roles: parseList(row.rolesJson),
          workTypes: parseList(row.workTypesJson),
        },
      ]),
    );
  }

  private applyShadowing(projectId: string, entries: ProjectSkillEntry[]): void {
    const byName = new Map<string, ProjectSkillEntry[]>();
    for (const entry of entries) {
      const duplicates = byName.get(entry.name) ?? [];
      duplicates.push(entry);
      byName.set(entry.name, duplicates);
    }
    const database = this.options.projectDatabases.get(projectId);
    for (const [name, duplicates] of byName) {
      const ranked = [...duplicates].sort(
        (left, right) =>
          scopeRank(right) - scopeRank(left) || left.location.localeCompare(right.location),
      );
      const winner = ranked[0]!;
      for (const loser of ranked.slice(1)) {
        loser.shadowedBy = winner.location;
        const eventKey = `${name}\0${loser.location}`;
        if (this.shadowedEvents.has(eventKey)) continue;
        this.shadowedEvents.add(eventKey);
        database
          .prepare(
            `INSERT INTO events (event_id, seq, kind, occurred_at, actor, payload)
             VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM events), ?, ?, ?, ?)`,
          )
          .run(
            uuidv7(),
            'skill.shadowed',
            this.now().toISOString(),
            'skill-registry',
            JSON.stringify({ name, loserLocation: loser.location, shadowedBy: winner.location }),
          );
      }
    }
  }
}

function scanSkillRoot(root: string, scope: 'project' | 'compat', trusted: boolean): SkillRecord[] {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) return [];
  const records: SkillRecord[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = path.join(root, entry.name);
    if (!existsSync(path.join(directory, 'SKILL.md'))) continue;
    try {
      const record = loadSkillDir(directory, scope, directory);
      records.push({
        ...record,
        warnings: trusted ? record.warnings : [...record.warnings, 'project_untrusted'],
      });
    } catch {
      continue;
    }
  }
  return records;
}

function emptyEnablement(name: string): SkillEnablement {
  return {
    name,
    enabled: false,
    pinnedVersion: null,
    pinnedHash: null,
    roles: null,
    workTypes: null,
  };
}

function parseList(value: string | null | undefined): string[] | null {
  return value === null || value === undefined ? null : (JSON.parse(value) as string[]);
}

function scopeRank(entry: ProjectSkillEntry): number {
  if (entry.scope === 'project') return 4;
  if (entry.source === 'builtin:gamecrafter') return 2;
  if (entry.scope === 'platform') return entry.enablement?.enabled ? 3 : 0;
  return 1;
}

function wrapSkillContent(record: SkillRecord, body: string): string {
  const version = record.version ?? '';
  const resources = record.resources.map((resource) => `- ${resource}`).join('\n');
  return `<skill_content name="${escapeAttribute(record.name)}" version="${escapeAttribute(version)}" dir="${escapeAttribute(record.location)}">\n<resources>\n${resources}\n</resources>\n\n${body}\n</skill_content>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    return '&quot;';
  });
}

/** Use packaged assets in production and the authored library in source-based tests. */
export function findBundledSkillsDirectory(): string {
  const candidates = [__dirname, path.resolve(__dirname, '../../../../.agents/skills')];
  const directory = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'game-development', 'SKILL.md')),
  );
  if (!directory)
    throw new Error('The bundled PlayWeld skill library is missing. Rebuild the platform service.');
  return directory;
}
