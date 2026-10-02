import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandService } from '@theia/core/lib/common/command';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import URI from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { EngineCapabilityReport, ProjectSummary } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import { CREATE_PROJECT_COMMAND_ID } from './create-project-command';
import { SETTINGS_OPEN_COMMAND_ID } from './settings-view-contribution';
import { MODELS_OPEN_COMMAND_ID } from './models-view-contribution';
import { SKILLS_OPEN_COMMAND_ID } from './skills-view-contribution';
import { CONNECTIONS_OPEN_COMMAND_ID } from './connections-view-contribution';
import { DISCUSSION_BOARD_OPEN_COMMAND_ID } from './discussion-board-view-contribution';
import { SWARM_OPEN_COMMAND_ID } from './swarm-view-contribution';
import { PLUGINS_OPEN_COMMAND_ID } from './plugins-catalog-view-contribution';
import { ENGINE_OPEN_COMMAND_ID } from './engine-view-contribution';
import { DCC_OPEN_COMMAND_ID } from './dcc-view-contribution';
import { KNOWLEDGE_OPEN_COMMAND_ID } from './knowledge-view-contribution';
import { ASSETS_OPEN_COMMAND_ID } from './assets-view-contribution';
import { BACKUPS_OPEN_COMMAND_ID } from './backups-view-contribution';
import { AUDIT_OPEN_COMMAND_ID } from './audit-view-contribution';
import { CHAT_OPEN_COMMAND_ID } from './chat-view-contribution';
import { UPDATES_OPEN_COMMAND_ID } from './updates-view-contribution';

@injectable()
export class ProjectHomeWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.projectHome';

  private projects: ProjectSummary[] = [];
  private readonly engineReports = new Map<string, EngineCapabilityReport>();
  private serviceStatus = 'Connecting…';

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(CommandService)
    private readonly commandService: CommandService,
    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {
    super();
    this.id = ProjectHomeWidget.ID;
    this.title.label = 'Project Home';
    this.title.iconClass = 'codicon codicon-home';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.projectChanged(() => {
        void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.engineCapabilitiesChanged(({ projectId, report }) => {
        this.engineReports.set(projectId, report);
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.serviceStatus(({ message }) => {
        this.serviceStatus = message ?? 'Unavailable';
        this.update();
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    return (
      <div className="gamecrafter-project-home gamecrafter-surface">
        <header className="gamecrafter-home-header">
          <div className="gamecrafter-home-brand">
            <span className="codicon codicon-package" aria-hidden="true" />
            <div>
              <h1>GameCrafter</h1>
              <p className="gamecrafter-home-subtitle">Your game development workspace.</p>
              <p role="status">{this.serviceStatus}</p>
            </div>
          </div>
          <button
            className="theia-button gamecrafter-primary-action"
            type="button"
            onClick={() => void this.commandService.executeCommand(CREATE_PROJECT_COMMAND_ID)}
          >
            <span className="codicon codicon-add" aria-hidden="true" /> Create Project
          </button>
        </header>
        <nav className="gamecrafter-project-home-actions" aria-label="Workspace tools">
          {HOME_ACTIONS.map(({ label, command, icon }) => (
            <button
              className="theia-button secondary"
              type="button"
              key={command}
              onClick={() => void this.commandService.executeCommand(command)}
            >
              <span className={`codicon codicon-${icon}`} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <section className="gamecrafter-home-guides" aria-label="Getting started">
          <article>
            <span className="gamecrafter-home-guide-kicker">01 · Models</span>
            <h2>Set up an LLM</h2>
            <p>
              Add a provider and discover a model in Models &amp; Routing, then chat here for
              Project-aware help or switch to Agent mode to delegate a change request to Swarm.
            </p>
            <p className="gamecrafter-home-guide-note">
              External IDE clients such as Copilot, Devin, and Kilo cannot call GameCrafter tools
              directly yet; their MCP server integration is still pending.
            </p>
            <div className="gamecrafter-home-guide-actions">
              <button
                className="theia-button secondary"
                type="button"
                onClick={() => void this.commandService.executeCommand(MODELS_OPEN_COMMAND_ID)}
              >
                Configure Models
              </button>
              <button
                className="theia-button"
                type="button"
                onClick={() => void this.commandService.executeCommand(SWARM_OPEN_COMMAND_ID)}
              >
                Open Swarm
              </button>
              <button
                className="theia-button secondary"
                type="button"
                onClick={() => void this.commandService.executeCommand(CHAT_OPEN_COMMAND_ID)}
              >
                Open Chat
              </button>
            </div>
          </article>
          <article>
            <span className="gamecrafter-home-guide-kicker">02 · Engine</span>
            <h2>Connect the game project</h2>
            <p>
              A GameCrafter Project is the game folder plus platform records. Native files belong in
              its <code>game/</code> directory. Unreal detection needs a valid{' '}
              <code>.uproject</code> there; registering an Unreal executable alone does not connect
              a separate project.
            </p>
            <p className="gamecrafter-home-guide-note">
              To try it now, create/open the GameCrafter Project, create the Unreal project inside{' '}
              <code>{'<Project>/game/'}</code>, then register <code>RunUAT.bat</code> and{' '}
              <code>UnrealEditor-Cmd.exe</code> in Engine. Importing an existing project folder
              directly is not supported yet.
            </p>
            <button
              className="theia-button secondary"
              type="button"
              onClick={() => void this.commandService.executeCommand(ENGINE_OPEN_COMMAND_ID)}
            >
              Open Engine setup
            </button>
          </article>
        </section>
        <h2 className="gamecrafter-home-projects-heading">Projects</h2>
        {this.projects.length === 0 ? (
          <div className="gamecrafter-project-home-empty">
            <span className="codicon codicon-folder-opened" aria-hidden="true" />
            <h3>No Projects yet</h3>
            <p>Create a Project to start building your game.</p>
          </div>
        ) : (
          <table className="gamecrafter-project-home-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Engine</th>
                <th>Engine layers</th>
                <th>Action</th>
                <th>Genres</th>
                <th>Path</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {this.projects.map((project) => (
                <tr key={project.projectId}>
                  <td>{project.name}</td>
                  <td>{project.engine.family}</td>
                  <td>{this.renderEngineStatus(project.projectId)}</td>
                  <td>
                    <button
                      className="theia-button"
                      type="button"
                      onClick={() => void this.openProject(project)}
                    >
                      Open
                    </button>
                  </td>
                  <td>{project.genres.join(', ')}</td>
                  <td>{project.path}</td>
                  <td>{new Date(project.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  private renderEngineStatus(projectId: string): React.ReactNode {
    const report = this.engineReports.get(projectId);
    if (!report)
      return (
        <span className="gamecrafter-engine-status gamecrafter-engine-status-unverified">
          Checking layers…
        </span>
      );
    const layers = ['project-file', 'headless-process', 'live-editor'] as const;
    const explanations = [
      report.projectIdentity.proven
        ? 'Native engine project files detected'
        : `No native ${report.family} project file detected`,
      report.engineVersion.detected
        ? `${report.family} ${report.engineVersion.detected} detected`
        : `${report.family} version not detected`,
      'Use Engine to register an installation or connect an editor',
    ];
    return (
      <div className="gamecrafter-project-engine-layers">
        {layers.map((layer) => (
          <span
            className={`gamecrafter-engine-status gamecrafter-engine-status-${report.layers[layer].status}`}
            key={layer}
            title={`${layer}: ${report.layers[layer].detail}`}
            aria-label={`${layer}: ${report.layers[layer].status}. ${report.layers[layer].detail}`}
          >
            {layer}: {report.layers[layer].status}
          </span>
        ))}
        {explanations.length > 0 && (
          <small className="gamecrafter-project-engine-details">{explanations.join(' ')}</small>
        )}
      </div>
    );
  }

  private async openProject(project: ProjectSummary): Promise<void> {
    try {
      await this.controlRoomService.openProject(project.path);
      await this.workspaceService.openWorkspace(URI.fromFilePath(project.path), {
        preserveWindow: true,
      });
    } catch (error) {
      await this.messageService.error(
        `Could not open ${project.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async refresh(): Promise<void> {
    try {
      const info = await this.controlRoomService.getServiceInfo();
      this.projects = await this.controlRoomService.listProjects();
      const reports = await Promise.all(
        this.projects.map(async (project) => {
          try {
            return [
              project.projectId,
              await this.controlRoomService.getEngineCapabilities(project.projectId),
            ] as const;
          } catch {
            return [project.projectId, null] as const;
          }
        }),
      );
      this.engineReports.clear();
      for (const [projectId, report] of reports)
        if (report) this.engineReports.set(projectId, report);
      this.serviceStatus = `Connected to platform service v${info.serviceVersion}`;
    } catch (error) {
      this.serviceStatus = `Unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.update();
  }
}

const HOME_ACTIONS = [
  { label: 'Updates', command: UPDATES_OPEN_COMMAND_ID, icon: 'sync' },
  { label: 'Settings', command: SETTINGS_OPEN_COMMAND_ID, icon: 'settings-gear' },
  { label: 'Models', command: MODELS_OPEN_COMMAND_ID, icon: 'hubot' },
  { label: 'Chat', command: CHAT_OPEN_COMMAND_ID, icon: 'comment-discussion' },
  { label: 'Skills & Roles', command: SKILLS_OPEN_COMMAND_ID, icon: 'organization' },
  { label: 'Connections', command: CONNECTIONS_OPEN_COMMAND_ID, icon: 'plug' },
  { label: 'Discussion Board', command: DISCUSSION_BOARD_OPEN_COMMAND_ID, icon: 'comment' },
  { label: 'Swarm', command: SWARM_OPEN_COMMAND_ID, icon: 'type-hierarchy' },
  { label: 'Plugins', command: PLUGINS_OPEN_COMMAND_ID, icon: 'extensions' },
  { label: 'Engine', command: ENGINE_OPEN_COMMAND_ID, icon: 'debug' },
  { label: 'DCC Tools', command: DCC_OPEN_COMMAND_ID, icon: 'tools' },
  { label: 'Knowledge', command: KNOWLEDGE_OPEN_COMMAND_ID, icon: 'book' },
  { label: 'Assets', command: ASSETS_OPEN_COMMAND_ID, icon: 'file-media' },
  { label: 'Audit & History', command: AUDIT_OPEN_COMMAND_ID, icon: 'history' },
  { label: 'Backups', command: BACKUPS_OPEN_COMMAND_ID, icon: 'archive' },
];
