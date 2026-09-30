import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { UpdatesWidget } from './updates-widget';

export const UPDATES_OPEN_COMMAND_ID = 'gamecrafter.updates.open';

@injectable()
export class UpdatesViewContribution extends AbstractViewContribution<UpdatesWidget> {
  constructor() {
    super({
      widgetId: UpdatesWidget.ID,
      widgetName: 'Updates',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: UPDATES_OPEN_COMMAND_ID, label: 'GameCrafter: Open Updates' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: UPDATES_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Updates',
    });
  }
}
