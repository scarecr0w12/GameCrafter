import type {
  EffectiveSetting,
  RpcNotificationParams,
  SettingsScope,
} from '@gamecrafter/contracts';
import { RpcError as ServiceRpcError, RpcErrorCode } from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import { ProjectDatabases } from '../projects/project-databases';
import { SettingsRegistry } from './registry';

export interface SettingsContext {
  projectId?: string;
  sessionId?: string;
}

export class SettingsService {
  private readonly sessions = new Map<string, Map<string, unknown>>();
  private readonly changedListeners = new Set<
    (event: RpcNotificationParams<'settings/changed'>) => void
  >();

  constructor(
    private readonly registry: SettingsRegistry,
    private readonly profileDatabase: Database,
    private readonly projectDatabases: ProjectDatabases,
    private readonly now: () => Date = () => new Date(),
  ) {}

  describe(): ReturnType<SettingsRegistry['describe']> {
    return this.registry.describe();
  }

  getAll(context: SettingsContext = {}): EffectiveSetting[] {
    return this.registry
      .describe()
      .definitions.map((definition) => this.resolve(definition.key, context));
  }

  resolve(key: string, context: SettingsContext = {}): EffectiveSetting {
    const definition = this.getDefinition(key);
    const layers: EffectiveSetting['layers'] = { default: definition.default };
    let source: EffectiveSetting['source'] = 'default';
    let value: unknown = definition.default;

    const platformValue = this.readOverride(this.profileDatabase, 'settings_values', key);
    if (platformValue.found) {
      layers.platform = platformValue.value;
      source = 'platform';
      value = platformValue.value;
    }

    if (context.projectId && definition.scopes.includes('project')) {
      const projectValue = this.readOverride(
        this.projectDatabases.get(context.projectId),
        'settings_overrides',
        key,
      );
      if (projectValue.found) {
        layers.project = projectValue.value;
        source = 'project';
        value = projectValue.value;
      }
    }

    if (context.sessionId && definition.scopes.includes('session')) {
      const session = this.sessions.get(context.sessionId);
      if (!session) {
        throw new ServiceRpcError(
          `Unknown session: ${context.sessionId}`,
          RpcErrorCode.UnknownSession,
        );
      }
      if (session.has(key)) {
        const sessionValue = session.get(key);
        layers.session = sessionValue;
        source = 'session';
        value = sessionValue;
      }
    }

    return { key, value, source, layers };
  }

  set(
    key: string,
    scope: SettingsScope,
    value: unknown,
    context: SettingsContext = {},
  ): EffectiveSetting {
    const definition = this.getDefinition(key);
    if (scope !== 'platform' && !definition.scopes.includes(scope)) {
      throw new ServiceRpcError(
        `Setting ${key} cannot be overridden at ${scope} scope`,
        RpcErrorCode.SettingScopeNotAllowed,
      );
    }
    if (scope === 'project' && !context.projectId) {
      throw new ServiceRpcError(
        'projectId is required for project-scoped settings',
        RpcErrorCode.InvalidParams,
      );
    }
    if (scope === 'session' && !context.sessionId) {
      throw new ServiceRpcError(
        'sessionId is required for session-scoped settings',
        RpcErrorCode.UnknownSession,
      );
    }
    if (value !== null) {
      const errors = this.registry.validateValue(key, value);
      if (errors.length > 0) {
        throw new ServiceRpcError(
          `Invalid value for setting ${key}`,
          RpcErrorCode.InvalidSettingValue,
          {
            errors,
          },
        );
      }
    }

    const updatedAt = this.now().toISOString();
    if (scope === 'platform') {
      this.writeOverride(this.profileDatabase, 'settings_values', key, value, updatedAt);
    } else if (scope === 'project') {
      this.writeOverride(
        this.projectDatabases.get(context.projectId!),
        'settings_overrides',
        key,
        value,
        updatedAt,
      );
    } else {
      const session = this.sessions.get(context.sessionId!);
      if (!session) {
        throw new ServiceRpcError(
          `Unknown session: ${context.sessionId}`,
          RpcErrorCode.UnknownSession,
        );
      }
      if (value === null) session.delete(key);
      else session.set(key, value);
    }

    const event: RpcNotificationParams<'settings/changed'> = {
      key,
      scope,
      ...(scope === 'project' ? { projectId: context.projectId } : {}),
      ...(scope === 'session' ? { sessionId: context.sessionId } : {}),
    };
    for (const listener of this.changedListeners) listener(event);
    return this.resolve(key, context);
  }

  openSession(sessionId: string): void {
    this.sessions.set(sessionId, new Map());
  }

  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  onChanged(listener: (event: RpcNotificationParams<'settings/changed'>) => void): () => void {
    this.changedListeners.add(listener);
    return () => this.changedListeners.delete(listener);
  }

  private getDefinition(key: string) {
    const definition = this.registry.get(key);
    if (!definition) {
      throw new ServiceRpcError(`Unknown setting: ${key}`, RpcErrorCode.UnknownSetting);
    }
    return definition;
  }

  private readOverride(
    database: Database,
    table: 'settings_values' | 'settings_overrides',
    key: string,
  ): { found: false } | { found: true; value: unknown } {
    const row = database
      .prepare(`SELECT value FROM ${table} WHERE key = ?`)
      .get<{ value: string }>(key);
    return row ? { found: true, value: JSON.parse(row.value) as unknown } : { found: false };
  }

  private writeOverride(
    database: Database,
    table: 'settings_values' | 'settings_overrides',
    key: string,
    value: unknown,
    updatedAt: string,
  ): void {
    if (value === null) {
      database.prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
      return;
    }
    database
      .prepare(
        `INSERT INTO ${table} (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), updatedAt);
  }
}
