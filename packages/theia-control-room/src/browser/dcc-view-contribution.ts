import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { DccWidget } from './dcc-widget';

export const DCC_OPEN_COMMAND_ID = 'gamecrafter.dcc.open';

@injectable()
export class DccViewContribution extends AbstractViewContribution<DccWidget> {
  constructor() {
    super({
      widgetId: DccWidget.ID,
      widgetName: 'DCC Tools',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: DCC_OPEN_COMMAND_ID, label: 'PlayWeld: Open DCC Tools' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: DCC_OPEN_COMMAND_ID,
      label: 'PlayWeld: Open DCC Tools',
    });
  }
}
