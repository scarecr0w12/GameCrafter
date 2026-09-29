import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { PluginsCatalogWidget } from './plugins-catalog-widget';

export const PLUGINS_OPEN_COMMAND_ID = 'gamecrafter.plugins.open';

@injectable()
export class PluginsCatalogViewContribution extends AbstractViewContribution<PluginsCatalogWidget> {
  constructor() {
    super({
      widgetId: PluginsCatalogWidget.ID,
      widgetName: 'Plugins',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: PLUGINS_OPEN_COMMAND_ID, label: 'GameCrafter: Open Plugins' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: PLUGINS_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Plugins',
    });
  }
}
