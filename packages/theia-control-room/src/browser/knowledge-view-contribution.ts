import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { KnowledgeWidget } from './knowledge-widget';

export const KNOWLEDGE_OPEN_COMMAND_ID = 'gamecrafter.knowledge.open';

@injectable()
export class KnowledgeViewContribution extends AbstractViewContribution<KnowledgeWidget> {
  constructor() {
    super({
      widgetId: KnowledgeWidget.ID,
      widgetName: 'Knowledge',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: KNOWLEDGE_OPEN_COMMAND_ID, label: 'PlayWeld: Open Knowledge' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: KNOWLEDGE_OPEN_COMMAND_ID,
      label: 'PlayWeld: Open Knowledge',
    });
  }
}
