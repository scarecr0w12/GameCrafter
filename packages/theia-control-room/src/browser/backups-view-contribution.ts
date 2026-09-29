import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { BackupsWidget } from './backups-widget';

export const BACKUPS_OPEN_COMMAND_ID = 'gamecrafter.backups.open';

@injectable()
export class BackupsViewContribution extends AbstractViewContribution<BackupsWidget> {
  constructor() {
    super({
      widgetId: BackupsWidget.ID,
      widgetName: 'Backups',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: BACKUPS_OPEN_COMMAND_ID, label: 'GameCrafter: Open Backups' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: BACKUPS_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Backups',
    });
  }
}
