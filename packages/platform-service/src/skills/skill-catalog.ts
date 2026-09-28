import {
  type AccessMode,
  type SkillCatalogEntry,
  type SkillEnablement,
  type SkillPlatformMetadata,
} from '@gamecrafter/contracts';
import type { SettingsService } from '../settings/settings-service';
import type { ProjectDatabases } from '../projects/project-databases';
import type { ProjectWorkspace } from '../projects/workspace';
import type { SkillRegistry } from './skill-registry';

export interface SkillCatalogRequest {
  projectId: string;
  agentRole?: string;
  workType?: string;
  taskText?: string;
  accessMode?: AccessMode;
}

interface SettingsReader {
  resolve: SettingsService['resolve'];
}

interface ActivationStats {
  lastActivatedAt: string | null;
  total: number;
  successes: number;
}

interface CapabilityPolicy {
  sideEffect: 'none' | 'workspace-write' | 'external-write' | 'paid' | 'destructive';
  toolIds: string[];
}

export class SkillCatalog {
  private readonly now: () => Date;

  constructor(
    private readonly options: {
      registry: SkillRegistry;
      workspace: Pick<ProjectWorkspace, 'get'>;
      projectDatabases: ProjectDatabases;
      settings: SettingsReader;
      now?: () => Date;
    },
  ) {
    this.now = options.now ?? (() => new Date());
  }

  catalog(
    request: SkillCatalogRequest,
    truncate = true,
  ): { entries: SkillCatalogEntry[]; truncated: boolean } {
    const project = this.options.workspace.get(request.projectId);
    const accessMode =
      request.accessMode ??
      (this.options.settings.resolve('access.mode', { projectId: request.projectId })
        .value as AccessMode);
    const skills = this.options.registry.listForProject(request.projectId);
    const eligible = skills.filter((skill) => {
      const roleEligible = matchesFilter(
        effectiveEligibility(skill.platform, skill.enablement, 'roles'),
        request.agentRole,
      );
      const workTypeEligible = matchesFilter(
        effectiveEligibility(skill.platform, skill.enablement, 'workTypes'),
        request.workType,
      );
      const engineEligible = matchesEngine(skill.platform, project.engine.family);
      const genreEligible = matchesGenres(skill.platform, project.genres);
      const capabilityEligible = this.capabilitiesAllowed(
        skill.platform.capabilities ?? [],
        accessMode,
        request.projectId,
      );
      return (
        skill.shadowedBy === null &&
        ((skill.scope !== 'project' && skill.scope !== 'compat') || project.trusted) &&
        (skill.scope !== 'platform' || isEnabled(skill.enablement)) &&
        (skill.scope !== 'platform' ||
          !isPinnedVersionMismatch(skill.version, skill.hash, skill.enablement)) &&
        roleEligible &&
        workTypeEligible &&
        engineEligible &&
        genreEligible &&
        capabilityEligible
      );
    });

    const entries = eligible
      .map((skill) => {
        const stats = this.activationStats(request.projectId, skill.name, request.workType);
        const observedSuccess = (stats.successes + 1) / (stats.total + 2);
        const lexical = lexicalOverlap(
          request.taskText ?? '',
          `${skill.name} ${skill.description}`,
        );
        const recency = recencyScore(stats.lastActivatedAt, this.now());
        return {
          name: skill.name,
          description: skill.description,
          location: skill.location,
          scope: skill.scope,
          version: skill.version,
          score: 0.5 * observedSuccess + 0.35 * lexical + 0.15 * recency,
        } satisfies SkillCatalogEntry;
      })
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    const maxEntries = truncate
      ? Math.max(
          5,
          Math.floor(
            Number(
              this.options.settings.resolve('skills.catalog.maxEntries', {
                projectId: request.projectId,
              }).value,
            ) || 40,
          ),
        )
      : entries.length;
    return {
      entries: entries.slice(0, maxEntries),
      truncated: truncate && entries.length > maxEntries,
    };
  }

  search(request: Omit<SkillCatalogRequest, 'taskText'> & { query: string }): SkillCatalogEntry[] {
    return this.catalog({ ...request, taskText: request.query }).entries;
  }

  private capabilitiesAllowed(
    capabilities: string[],
    accessMode: AccessMode,
    projectId: string,
  ): boolean {
    if (accessMode === 'full' || accessMode === 'ask-always') return true;
    const allowedSideEffects = this.options.settings.resolve(
      'access.restricted.allowedSideEffects',
      {
        projectId,
      },
    ).value as string[];
    const allowedTools = this.options.settings.resolve('access.restricted.allowedTools', {
      projectId,
    }).value as string[];
    return capabilities.every((capability) => {
      const policy = capabilityPolicy(capability);
      if (allowedSideEffects.includes(policy.sideEffect)) return true;
      return policy.toolIds.some((toolId) =>
        allowedTools.some((pattern) => matchesGlob(pattern, toolId)),
      );
    });
  }

  private activationStats(projectId: string, name: string, workType?: string): ActivationStats {
    const database = this.options.projectDatabases.get(projectId);
    const lastActivation = database
      .prepare('SELECT MAX(activated_at) AS lastActivatedAt FROM skill_activations WHERE name = ?')
      .get<{ lastActivatedAt: string | null }>(name);
    const outcomeQuery = workType
      ? `SELECT COUNT(t.task_id) AS total,
          SUM(CASE WHEN t.state = 'succeeded' THEN 1 ELSE 0 END) AS successes
         FROM skill_activations a JOIN tasks t ON t.task_id = a.task_id
         WHERE a.name = ? AND t.kind = ? AND t.state IN ('succeeded', 'failed', 'cancelled')`
      : `SELECT COUNT(t.task_id) AS total,
          SUM(CASE WHEN t.state = 'succeeded' THEN 1 ELSE 0 END) AS successes
         FROM skill_activations a JOIN tasks t ON t.task_id = a.task_id
         WHERE a.name = ? AND t.state IN ('succeeded', 'failed', 'cancelled')`;
    const outcomes = workType
      ? database
          .prepare(outcomeQuery)
          .get<{ total: number; successes: number | null }>(name, workType)
      : database.prepare(outcomeQuery).get<{ total: number; successes: number | null }>(name);
    return {
      lastActivatedAt: lastActivation?.lastActivatedAt ?? null,
      total: outcomes?.total ?? 0,
      successes: outcomes?.successes ?? 0,
    };
  }
}

function effectiveEligibility(
  platform: SkillPlatformMetadata,
  enablement: SkillEnablement | null,
  field: 'roles' | 'workTypes',
): string[] {
  const override = enablement?.[field];
  if (override !== null && override !== undefined) return override;
  return platform[field] ?? [];
}

function isEnabled(enablement: SkillEnablement | null): boolean {
  return enablement?.enabled === true;
}

function isPinnedVersionMismatch(
  version: string | null,
  hash: string,
  enablement: SkillEnablement | null,
): boolean {
  return Boolean(
    (enablement?.pinnedVersion && enablement.pinnedVersion !== version) ||
    (enablement?.pinnedHash && enablement.pinnedHash !== hash),
  );
}

function matchesFilter(values: string[], requested?: string): boolean {
  return values.length === 0 || (requested !== undefined && values.includes(requested));
}

function matchesEngine(platform: SkillPlatformMetadata, engine: string): boolean {
  const engines = platform.engines ?? [];
  return engines.length === 0 || engines.includes('*') || engines.includes(engine);
}

function matchesGenres(platform: SkillPlatformMetadata, projectGenres: string[]): boolean {
  const genres = platform.genres ?? [];
  return (
    genres.length === 0 ||
    genres.includes('*') ||
    genres.some((genre) => projectGenres.includes(genre))
  );
}

function capabilityPolicy(capability: string): CapabilityPolicy {
  if (/^fs\.read:/i.test(capability))
    return { sideEffect: 'none', toolIds: ['fs/read-file', 'fs/list'] };
  if (/^fs\.write:/i.test(capability))
    return { sideEffect: 'workspace-write', toolIds: ['fs/write-file'] };
  if (/^process\.spawn/i.test(capability))
    return { sideEffect: 'destructive', toolIds: ['process/run'] };
  if (/^network/i.test(capability)) return { sideEffect: 'external-write', toolIds: [] };
  if (/^paid/i.test(capability)) return { sideEffect: 'paid', toolIds: [] };
  return { sideEffect: 'destructive', toolIds: [] };
}

function matchesGlob(pattern: string, value: string): boolean {
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        expression += '.*';
        index += 1;
      } else {
        expression += '[^/]*';
      }
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${expression}$`).test(value);
}

function lexicalOverlap(query: string, text: string): number {
  const queryTokens = new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  if (queryTokens.size === 0) return 0;
  const textTokens = new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  let matches = 0;
  for (const token of queryTokens) if (textTokens.has(token)) matches += 1;
  return matches / queryTokens.size;
}

function recencyScore(lastActivatedAt: string | null, now: Date): number {
  if (!lastActivatedAt) return 0;
  const ageDays = Math.max(0, (now.getTime() - Date.parse(lastActivatedAt)) / 86_400_000);
  return Math.max(0, 1 - ageDays / 30);
}
