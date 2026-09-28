import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { GameCrafterSettingsWidget } from './settings-widget';

export const SETTINGS_OPEN_COMMAND_ID = 'gamecrafter.settings.open';

@injectable()
export class SettingsViewContribution extends AbstractViewContribution<GameCrafterSettingsWidget> {
  constructor() {
    super({
      widgetId: GameCrafterSettingsWidget.ID,
      widgetName: 'GameCrafter Settings',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: SETTINGS_OPEN_COMMAND_ID, label: 'GameCrafter: Open Settings' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: SETTINGS_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Settings',
    });
  }
}
