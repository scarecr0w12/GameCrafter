import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import {
  RpcError,
  type EffectiveSetting,
  type ProjectSummary,
  type SettingDefinition,
  type SettingGroup,
  type SettingsScope,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { controlKindFor, filterDefinitions, groupDefinitions } from '../common/settings-view-model';
import { ControlRoomClientEvents } from './control-room-client';

const sourceLabels: Record<EffectiveSetting['source'], string> = {
  default: 'Default',
  platform: 'Platform',
  project: 'Project',
  session: 'Session',
};

@injectable()
export class GameCrafterSettingsWidget extends ReactWidget {
  static readonly ID = 'gamecrafter.settings';

  private groups: SettingGroup[] = [];
  private definitions: SettingDefinition[] = [];
  private projects: ProjectSummary[] = [];
  private settings = new Map<string, EffectiveSetting>();
  private selectedGroup?: string;
  private selectedProjectId?: string;
  private searchQuery = '';
  private readonly scopes = new Map<string, SettingsScope>();
  private errorMessage?: string;

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {
    super();
    this.id = GameCrafterSettingsWidget.ID;
    this.title.label = 'GameCrafter Settings';
    this.title.iconClass = 'codicon codicon-settings-gear';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.settingsChanged(() => {
        void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.projectChanged(() => {
        void this.refresh();
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const visibleDefinitions = filterDefinitions(this.definitions, this.searchQuery);
    const grouped = groupDefinitions(visibleDefinitions, this.groups);
    const visibleGroups = this.searchQuery.trim()
      ? grouped.filter(({ definitions }) => definitions.length > 0)
      : grouped;
    const activeGroup = visibleGroups.find(({ group }) => group.id === this.selectedGroup);
    const activeDefinitions = activeGroup?.definitions ?? [];

    return (
      <div className="gamecrafter-settings">
        <header className="gamecrafter-settings-header">
          <h1>GameCrafter Settings</h1>
        </header>
        <div className="gamecrafter-settings-toolbar">
          <label className="gamecrafter-settings-project">
            <span>Project</span>
            <select
              aria-label="Project"
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.selectedProjectId = event.currentTarget.value || undefined;
                void this.refresh();
              }}
            >
              <option value="">No Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="gamecrafter-settings-search">
            <span>Search settings</span>
            <input
              type="search"
              value={this.searchQuery}
              onChange={(event) => {
                this.searchQuery = event.currentTarget.value;
                const matchingGroups = groupDefinitions(
                  filterDefinitions(this.definitions, this.searchQuery),
                  this.groups,
                ).filter(({ definitions }) => definitions.length > 0);
                if (!matchingGroups.some(({ group }) => group.id === this.selectedGroup)) {
                  this.selectedGroup = matchingGroups[0]?.group.id;
                }
                this.update();
              }}
            />
          </label>
        </div>
        {this.errorMessage ? <p role="alert">{this.errorMessage}</p> : undefined}
        <div className="gamecrafter-settings-layout">
          <nav className="gamecrafter-settings-groups" aria-label="Settings groups">
            {visibleGroups.map(({ group, definitions }) => (
              <button
                className={
                  group.id === this.selectedGroup
                    ? 'gamecrafter-settings-group is-active'
                    : 'gamecrafter-settings-group'
                }
                key={group.id}
                type="button"
                onClick={() => {
                  this.selectedGroup = group.id;
                  this.update();
                }}
              >
                <span>{group.title}</span>
                <span>{definitions.length}</span>
              </button>
            ))}
          </nav>
          <section className="gamecrafter-settings-content">
            {activeGroup ? <h2>{activeGroup.group.title}</h2> : <h2>Settings</h2>}
            {activeDefinitions.length === 0 ? (
              <p>No settings in this group match the current search.</p>
            ) : (
              activeDefinitions.map((definition) => this.renderSetting(definition))
            )}
          </section>
        </div>
      </div>
    );
  }

  private renderSetting(definition: SettingDefinition): React.ReactNode {
    const effective = this.settings.get(definition.key);
    const scope = this.selectedScope(definition, effective);
    const value = effective?.value ?? definition.default;
    const scopes = this.allowedScopes(definition);
    const disabled = scope === 'project' && !this.selectedProjectId;
    const hasOverride = Boolean(
      effective && Object.prototype.hasOwnProperty.call(effective.layers, scope),
    );

    return (
      <article className="gamecrafter-setting-row" key={definition.key}>
        <div>
          <strong>{definition.title}</strong>
          <div className="gamecrafter-setting-description">{definition.description}</div>
          <code>{definition.key}</code>
        </div>
        <div className="gamecrafter-setting-control">
          {this.renderControl(definition, value, scope, disabled)}
          <label>
            <span>Scope</span>
            <select
              aria-label={`${definition.title} scope`}
              value={scope}
              onChange={(event) => {
                this.scopes.set(definition.key, event.currentTarget.value as SettingsScope);
                this.update();
              }}
            >
              {scopes.map((candidate) => (
                <option
                  disabled={candidate === 'project' && !this.selectedProjectId}
                  key={candidate}
                  value={candidate}
                >
                  {sourceLabels[candidate]}
                </option>
              ))}
            </select>
          </label>
          <span className="gamecrafter-setting-source">
            {sourceLabels[effective?.source ?? 'default']}
          </span>
          <button
            className="gamecrafter-settings-reset"
            type="button"
            disabled={disabled || !hasOverride}
            onClick={() => void this.saveSetting(definition, scope, null)}
          >
            Reset to inherit
          </button>
        </div>
      </article>
    );
  }

  private renderControl(
    definition: SettingDefinition,
    value: unknown,
    scope: SettingsScope,
    disabled: boolean,
  ): React.ReactNode {
    const kind = controlKindFor(definition.schema);
    const schema = definition.schema;
    const common = {
      'aria-label': definition.title,
      disabled,
    };

    if (kind === 'boolean') {
      return (
        <input
          {...common}
          type="checkbox"
          checked={value === true}
          onChange={(event) =>
            void this.saveSetting(definition, scope, event.currentTarget.checked)
          }
        />
      );
    }
    if (kind === 'enum') {
      const choices = Array.isArray(schema.enum) ? schema.enum : [];
      return (
        <select
          {...common}
          value={String(value)}
          onChange={(event) => void this.saveSetting(definition, scope, event.currentTarget.value)}
        >
          {choices.map((choice) => (
            <option key={String(choice)} value={String(choice)}>
              {String(choice)}
            </option>
          ))}
        </select>
      );
    }
    if (kind === 'enum-array') {
      const items =
        typeof schema.items === 'object' && schema.items !== null && !Array.isArray(schema.items)
          ? (schema.items as Record<string, unknown>)
          : undefined;
      const choices = items && Array.isArray(items.enum) ? items.enum : [];
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <fieldset className="gamecrafter-setting-array-options" aria-label={definition.title}>
          <legend>{definition.title}</legend>
          {choices.map((choice) => {
            const option = String(choice);
            return (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.currentTarget.checked) next.add(option);
                    else next.delete(option);
                    void this.saveSetting(definition, scope, [...next]);
                  }}
                />
                {option}
              </label>
            );
          })}
        </fieldset>
      );
    }
    if (kind === 'string-array') {
      const entries = Array.isArray(value) ? value.map(String) : [];
      return (
        <input
          {...common}
          type="text"
          value={entries.join(', ')}
          onChange={(event) => {
            const values = event.currentTarget.value
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item.length > 0);
            void this.saveSetting(definition, scope, [...new Set(values)]);
          }}
        />
      );
    }
    if (kind === 'number') {
      return (
        <input
          {...common}
          type="number"
          min={typeof schema.minimum === 'number' ? schema.minimum : undefined}
          max={typeof schema.maximum === 'number' ? schema.maximum : undefined}
          step={schema.type === 'integer' ? 1 : 'any'}
          value={String(value)}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            void this.saveSetting(definition, scope, raw === '' ? null : Number(raw));
          }}
        />
      );
    }
    if (kind === 'string') {
      return (
        <input
          {...common}
          type="text"
          value={String(value)}
          onChange={(event) => void this.saveSetting(definition, scope, event.currentTarget.value)}
        />
      );
    }
    return <span>Unsupported setting schema</span>;
  }

  private allowedScopes(definition: SettingDefinition): SettingsScope[] {
    return [...new Set<SettingsScope>(['platform', ...definition.scopes])];
  }

  private selectedScope(
    definition: SettingDefinition,
    effective?: EffectiveSetting,
  ): SettingsScope {
    const allowed = this.allowedScopes(definition);
    const selected = this.scopes.get(definition.key);
    if (
      selected &&
      allowed.includes(selected) &&
      (selected !== 'project' || this.selectedProjectId)
    ) {
      return selected;
    }
    if (effective && effective.source !== 'default' && allowed.includes(effective.source)) {
      return effective.source;
    }
    return this.selectedProjectId && allowed.includes('project') ? 'project' : 'platform';
  }

  private async saveSetting(
    definition: SettingDefinition,
    scope: SettingsScope,
    value: unknown,
  ): Promise<void> {
    try {
      const effective = await this.controlRoomService.setSetting(
        definition.key,
        scope,
        value,
        this.selectedProjectId,
      );
      this.settings.set(definition.key, effective);
      this.errorMessage = undefined;
      this.update();
    } catch (error) {
      const message =
        error instanceof RpcError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      this.errorMessage = message;
      this.update();
      await this.messageService.error(message);
    }
  }

  private async refresh(): Promise<void> {
    try {
      const [description, projects, settings] = await Promise.all([
        this.controlRoomService.describeSettings(),
        this.controlRoomService.listProjects(),
        this.controlRoomService.getAllSettings(this.selectedProjectId),
      ]);
      this.groups = description.groups;
      this.definitions = description.definitions;
      this.projects = projects;
      if (!this.groups.some((group) => group.id === this.selectedGroup)) {
        this.selectedGroup = this.groups[0]?.id;
      }
      if (!this.projects.some((project) => project.projectId === this.selectedProjectId)) {
        this.selectedProjectId = undefined;
      }
      this.settings = new Map(settings.map((setting) => [setting.key, setting]));
      this.errorMessage = undefined;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
  }
}
