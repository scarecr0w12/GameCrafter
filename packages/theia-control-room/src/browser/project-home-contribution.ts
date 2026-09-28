import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { ProjectHomeWidget } from './project-home-widget';

export const PROJECT_HOME_TOGGLE_COMMAND_ID = 'gamecrafter.projectHome.toggle';

@injectable()
export class ProjectHomeContribution extends AbstractViewContribution<ProjectHomeWidget> {
  constructor() {
    super({
      widgetId: ProjectHomeWidget.ID,
      widgetName: 'Project Home',
      defaultWidgetOptions: { area: 'main' },
      toggleCommandId: PROJECT_HOME_TOGGLE_COMMAND_ID,
    });
  }

  async onStart(): Promise<void> {
    await this.openView({ activate: true, reveal: true });
  }
}
