import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { AuditWidget } from './audit-widget';

export const AUDIT_OPEN_COMMAND_ID = 'gamecrafter.audit.open';

@injectable()
export class AuditViewContribution extends AbstractViewContribution<AuditWidget> {
  constructor() {
    super({
      widgetId: AuditWidget.ID,
      widgetName: 'Audit',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: AUDIT_OPEN_COMMAND_ID, label: 'GameCrafter: Open Audit' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: AUDIT_OPEN_COMMAND_ID,
      label: 'GameCrafter: Open Audit',
    });
  }
}
