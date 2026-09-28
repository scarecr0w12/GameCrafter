import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { ModelsWidget } from './models-widget';

export const MODELS_OPEN_COMMAND_ID = 'gamecrafter.models.open';

@injectable()
export class ModelsViewContribution extends AbstractViewContribution<ModelsWidget> {
  constructor() {
    super({
      widgetId: ModelsWidget.ID,
      widgetName: 'Models & Routing',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: MODELS_OPEN_COMMAND_ID, label: 'GameCrafter: Open Models & Routing' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: MODELS_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Models & Routing',
    });
  }
}
