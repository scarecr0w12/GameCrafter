import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { ConnectionsWidget } from './connections-widget';

export const CONNECTIONS_OPEN_COMMAND_ID = 'gamecrafter.connections.open';

@injectable()
export class ConnectionsViewContribution extends AbstractViewContribution<ConnectionsWidget> {
  constructor() {
    super({
      widgetId: ConnectionsWidget.ID,
      widgetName: 'Connections',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: CONNECTIONS_OPEN_COMMAND_ID, label: 'PlayWeld: Open Connections' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: CONNECTIONS_OPEN_COMMAND_ID,
      label: 'PlayWeld: Open Connections',
    });
  }
}
