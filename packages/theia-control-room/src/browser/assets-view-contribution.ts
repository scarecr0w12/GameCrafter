import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { AssetsWidget } from './assets-widget';

export const ASSETS_OPEN_COMMAND_ID = 'gamecrafter.assets.open';

@injectable()
export class AssetsViewContribution extends AbstractViewContribution<AssetsWidget> {
  constructor() {
    super({
      widgetId: AssetsWidget.ID,
      widgetName: 'Assets',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: ASSETS_OPEN_COMMAND_ID, label: 'GameCrafter: Open Assets' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: ASSETS_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Assets',
    });
  }
}
