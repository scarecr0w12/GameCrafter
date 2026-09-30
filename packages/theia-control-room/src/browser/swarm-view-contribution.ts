import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { SwarmWidget } from './swarm-widget';

export const SWARM_OPEN_COMMAND_ID = 'gamecrafter.swarm.open';

@injectable()
export class SwarmViewContribution extends AbstractViewContribution<SwarmWidget> {
  constructor() {
    super({
      widgetId: SwarmWidget.ID,
      widgetName: 'Swarm',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: SWARM_OPEN_COMMAND_ID, label: 'GameCrafter: Open Swarm' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: SWARM_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Swarm',
    });
  }
}
