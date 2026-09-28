import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type {
  ProjectSkillEntry,
  ProjectSummary,
  RoleRecord,
  SkillCatalogEntry,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';

@injectable()
export class SkillsWidget extends ReactWidget {
  static readonly ID = 'gamecrafter.skills';

  private projects: ProjectSummary[] = [];
  private selectedProjectId?: string;
  private skills: ProjectSkillEntry[] = [];
  private roles: RoleRecord[] = [];
  private catalog: SkillCatalogEntry[] = [];
  private catalogTruncated = false;
  private source = '';
  private installName = '';
  private forceInstall = false;
  private catalogRole = '';
  private catalogWorkType = '';
  private taskText = '';
  private errorMessage?: string;
  private resultMessage?: string;

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
  ) {
    super();
    this.id = SkillsWidget.ID;
    this.title.label = 'Skills & Roles';
    this.title.iconClass = 'codicon codicon-library';
    this.title.closable = true;
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const selectedProject = this.projects.find(
      (project) => project.projectId === this.selectedProjectId,
    );
    return (
      <div className="gamecrafter-skills">
        <header className="gamecrafter-skills-header">
          <h1>Skills &amp; Roles</h1>
          <label>
            Project
            <select
              aria-label="Skills Project"
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
          <button type="button" onClick={() => void this.refresh()}>
            Refresh
          </button>
        </header>
        {selectedProject && !selectedProject.trusted && (
          <aside className="gamecrafter-skills-untrusted" role="alert">
            <span>
              Untrusted Project. Project-local and compatibility skills are listed but cannot be
              activated.
            </span>
            <button type="button" onClick={() => void this.trustProject()}>
              Trust Project
            </button>
          </aside>
        )}
        {this.errorMessage && (
          <p className="gamecrafter-skills-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-skills-result" role="status">
            {this.resultMessage}
          </p>
        )}

        <section className="gamecrafter-skills-section">
          <h2>Install a skill</h2>
          <form
            className="gamecrafter-skills-install-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.installSkills();
            }}
          >
            <label>
              Source
              <input
                aria-label="Skill source"
                placeholder="owner/repo, local path, or archive URL"
                value={this.source}
                onChange={(event) => {
                  this.source = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label>
              Name (optional)
              <input
                aria-label="Skill name"
                value={this.installName}
                onChange={(event) => {
                  this.installName = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label className="gamecrafter-skills-inline-checkbox">
              <input
                aria-label="Replace installed skill"
                type="checkbox"
                checked={this.forceInstall}
                onChange={(event) => {
                  this.forceInstall = event.currentTarget.checked;
                  this.update();
                }}
              />
              Replace existing version
            </label>
            <button type="submit" disabled={!this.source.trim()}>
              Install
            </button>
          </form>
        </section>

        <section className="gamecrafter-skills-section">
          <h2>Project skills</h2>
          {this.skills.length === 0 ? (
            <p>No skills found for this Project.</p>
          ) : (
            <div className="gamecrafter-skills-table-scroll">
              <table className="gamecrafter-skills-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scope</th>
                    <th>Version</th>
                    <th>Description</th>
                    <th>Enabled</th>
                    <th>Roles override</th>
                    <th>Work types override</th>
                    <th>Shadowing</th>
                    <th>Warnings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.skills.map((skill) => (
                    <tr key={`${skill.scope}:${skill.location}`}>
                      <td>{skill.name}</td>
                      <td>
                        <span
                          className={`gamecrafter-skills-scope gamecrafter-skills-scope-${skill.scope}`}
                        >
                          {skill.scope}
                        </span>
                      </td>
                      <td>{skill.version ?? '—'}</td>
                      <td>{skill.description}</td>
                      <td>
                        {skill.scope === 'platform' ? (
                          <input
                            aria-label={`Enable skill ${skill.name}`}
                            type="checkbox"
                            checked={skill.enablement?.enabled ?? false}
                            onChange={(event) =>
                              void this.updateEnablement(skill, {
                                enabled: event.currentTarget.checked,
                              })
                            }
                          />
                        ) : (
                          'Local'
                        )}
                      </td>
                      <td>
                        {skill.scope === 'platform' ? (
                          <input
                            aria-label={`Skill roles ${skill.name}`}
                            defaultValue={skill.enablement?.roles?.join(', ') ?? ''}
                            onBlur={(event) =>
                              void this.updateEnablement(skill, {
                                roles: parseOverride(event.currentTarget.value),
                              })
                            }
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {skill.scope === 'platform' ? (
                          <input
                            aria-label={`Skill work types ${skill.name}`}
                            defaultValue={skill.enablement?.workTypes?.join(', ') ?? ''}
                            onBlur={(event) =>
                              void this.updateEnablement(skill, {
                                workTypes: parseOverride(event.currentTarget.value),
                              })
                            }
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{skill.shadowedBy ? `Shadowed by ${skill.shadowedBy}` : '—'}</td>
                      <td>{skill.warnings.join('; ') || '—'}</td>
                      <td>
                        {skill.scope === 'platform' && (
                          <button
                            type="button"
                            onClick={() => void this.uninstallSkill(skill.name)}
                          >
                            Uninstall
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="gamecrafter-skills-section">
          <h2>Preview catalog</h2>
          <div className="gamecrafter-skills-catalog-form">
            <label>
              Agent role
              <input
                aria-label="Catalog agent role"
                list="gamecrafter-skill-roles"
                value={this.catalogRole}
                onChange={(event) => {
                  this.catalogRole = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <datalist id="gamecrafter-skill-roles">
              {this.roles.map((role) => (
                <option key={role.name} value={role.name} />
              ))}
            </datalist>
            <label>
              Work type
              <input
                aria-label="Catalog work type"
                value={this.catalogWorkType}
                onChange={(event) => {
                  this.catalogWorkType = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label className="gamecrafter-skills-task-text">
              Task text
              <input
                aria-label="Catalog task text"
                value={this.taskText}
                onChange={(event) => {
                  this.taskText = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <button
              type="button"
              disabled={!this.selectedProjectId}
              onClick={() => void this.previewCatalog()}
            >
              Preview catalog
            </button>
          </div>
          {this.catalog.length > 0 && (
            <>
              {this.catalogTruncated && (
                <p role="status">Catalog truncated; use skill search for more eligible skills.</p>
              )}
              <ol className="gamecrafter-skills-catalog-list">
                {this.catalog.map((entry) => (
                  <li key={`${entry.scope}:${entry.location}`}>
                    <strong>{entry.name}</strong>{' '}
                    <span>
                      ({entry.scope}, score {entry.score.toFixed(3)})
                    </span>
                    <p>{entry.description}</p>
                    <code>{entry.location}</code>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section className="gamecrafter-skills-section">
          <h2>Roles</h2>
          {this.roles.length === 0 ? (
            <p>No roles found.</p>
          ) : (
            <div className="gamecrafter-skills-table-scroll">
              <table className="gamecrafter-skills-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scope</th>
                    <th>Work types</th>
                    <th>Max access</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {this.roles.map((role) => (
                    <tr key={`${role.scope}:${role.name}`}>
                      <td>{role.name}</td>
                      <td>{role.scope}</td>
                      <td>{role.workTypes.join(', ') || 'Any'}</td>
                      <td>{role.maxAccess}</td>
                      <td>{role.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  private async refresh(): Promise<void> {
    try {
      this.projects = await this.controlRoomService.listProjects();
      if (!this.selectedProjectId && this.projects.length > 0) {
        this.selectedProjectId = this.projects[0]!.projectId;
      }
      const [skills, roles] = await Promise.all([
        this.controlRoomService.listSkills(this.selectedProjectId),
        this.controlRoomService.listRoles(this.selectedProjectId),
      ]);
      this.skills = skills;
      this.roles = roles;
      this.errorMessage = undefined;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
  }

  private async run(operation: () => Promise<unknown>): Promise<void> {
    try {
      this.errorMessage = undefined;
      this.resultMessage = undefined;
      await operation();
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  private async installSkills(): Promise<void> {
    await this.run(async () => {
      const installed = await this.controlRoomService.installSkills(
        this.source.trim(),
        this.installName.trim() || undefined,
        this.forceInstall,
      );
      this.resultMessage = `Installed ${installed.map((skill) => skill.name).join(', ')}.`;
      this.source = '';
      this.installName = '';
    });
  }

  private async uninstallSkill(name: string): Promise<void> {
    await this.run(async () => {
      await this.controlRoomService.uninstallSkill(name);
      this.resultMessage = `Uninstalled ${name}.`;
    });
  }

  private async updateEnablement(
    skill: ProjectSkillEntry,
    patch: { enabled?: boolean; roles?: string[] | null; workTypes?: string[] | null },
  ): Promise<void> {
    if (skill.scope !== 'platform' || !this.selectedProjectId) return;
    await this.run(() =>
      this.controlRoomService.enableSkill({
        projectId: this.selectedProjectId!,
        name: skill.name,
        enabled: patch.enabled ?? skill.enablement?.enabled ?? false,
        ...(patch.roles === undefined ? {} : { roles: patch.roles }),
        ...(patch.workTypes === undefined ? {} : { workTypes: patch.workTypes }),
      }),
    );
  }

  private async previewCatalog(): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.run(async () => {
      const result = await this.controlRoomService.previewSkillCatalog({
        projectId: this.selectedProjectId!,
        agentRole: this.catalogRole || undefined,
        workType: this.catalogWorkType || undefined,
        taskText: this.taskText || undefined,
      });
      this.catalog = result.entries;
      this.catalogTruncated = result.truncated;
    });
  }

  private async trustProject(): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.run(() => this.controlRoomService.trustProject(this.selectedProjectId!, true));
  }
}

function parseOverride(value: string): string[] | null {
  const values = [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return values.length > 0 ? values : null;
}
