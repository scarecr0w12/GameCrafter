import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { EngineWidget } from './engine-widget';

export const ENGINE_OPEN_COMMAND_ID = 'gamecrafter.engine.open';

@injectable()
export class EngineViewContribution extends AbstractViewContribution<EngineWidget> {
  constructor() {
    super({
      widgetId: EngineWidget.ID,
      widgetName: 'Engine',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: ENGINE_OPEN_COMMAND_ID, label: 'PlayWeld: Open Engine' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: ENGINE_OPEN_COMMAND_ID,
      label: 'PlayWeld: Open Engine',
    });
  }
}
