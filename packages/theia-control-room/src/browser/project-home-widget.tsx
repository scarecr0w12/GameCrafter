import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandService } from '@theia/core/lib/common/command';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { ProjectSummary } from '@gamecrafter/contracts';
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
import { PLUGINS_OPEN_COMMAND_ID } from './plugins-catalog-view-contribution';

@injectable()
export class ProjectHomeWidget extends ReactWidget {
  static readonly ID = 'gamecrafter.projectHome';

  private projects: ProjectSummary[] = [];
  private serviceStatus = 'Connecting…';

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(CommandService)
    private readonly commandService: CommandService,
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
      <div className="gamecrafter-project-home">
        <header>
          <h1>GameCrafter</h1>
          <p role="status">{this.serviceStatus}</p>
        </header>
        <div className="gamecrafter-project-home-actions">
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.commandService.executeCommand(CREATE_PROJECT_COMMAND_ID)}
          >
            Create Project
          </button>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.commandService.executeCommand(SETTINGS_OPEN_COMMAND_ID)}
          >
            Settings
          </button>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.commandService.executeCommand(MODELS_OPEN_COMMAND_ID)}
          >
            Models
          </button>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.commandService.executeCommand(SKILLS_OPEN_COMMAND_ID)}
          >
            Skills &amp; Roles
          </button>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.commandService.executeCommand(CONNECTIONS_OPEN_COMMAND_ID)}
          >
            Connections
          </button>
          <button
            className="theia-button"
            type="button"
            onClick={() =>
              void this.commandService.executeCommand(DISCUSSION_BOARD_OPEN_COMMAND_ID)
            }
          >
            Discussion Board
          </button>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.commandService.executeCommand(PLUGINS_OPEN_COMMAND_ID)}
          >
            Plugins
          </button>
        </div>
        {this.projects.length === 0 ? (
          <p className="gamecrafter-project-home-empty">
            No Projects yet. Create a Project to get started.
          </p>
        ) : (
          <table className="gamecrafter-project-home-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Engine</th>
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

  private async refresh(): Promise<void> {
    try {
      const info = await this.controlRoomService.getServiceInfo();
      this.projects = await this.controlRoomService.listProjects();
      this.serviceStatus = `Connected to platform service v${info.serviceVersion}`;
    } catch (error) {
      this.serviceStatus = `Unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.update();
  }
}
