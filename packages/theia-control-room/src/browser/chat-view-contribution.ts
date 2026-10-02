import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { ChatWidget } from './chat-widget';

export const CHAT_OPEN_COMMAND_ID = 'gamecrafter.chat.open';

@injectable()
export class ChatViewContribution extends AbstractViewContribution<ChatWidget> {
  constructor() {
    super({
      widgetId: ChatWidget.ID,
      widgetName: 'PlayWeld Chat',
      defaultWidgetOptions: { area: 'right' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: CHAT_OPEN_COMMAND_ID, label: 'PlayWeld: Open Chat' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: CHAT_OPEN_COMMAND_ID,
      label: 'PlayWeld: Open Chat',
    });
  }
}
