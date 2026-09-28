import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { SkillsWidget } from './skills-widget';

export const SKILLS_OPEN_COMMAND_ID = 'gamecrafter.skills.open';

@injectable()
export class SkillsViewContribution extends AbstractViewContribution<SkillsWidget> {
  constructor() {
    super({
      widgetId: SkillsWidget.ID,
      widgetName: 'Skills & Roles',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: SKILLS_OPEN_COMMAND_ID, label: 'GameCrafter: Open Skills & Roles' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: SKILLS_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Skills & Roles',
    });
  }
}
