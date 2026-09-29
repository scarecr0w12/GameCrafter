import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { ControlRoomService, CONTROL_ROOM_SERVICE_PATH } from '../common/control-room-protocol';
import { ControlRoomClientEvents, ControlRoomClientToken } from './control-room-client';
import { CreateProjectCommand } from './create-project-command';
import { ProjectHomeContribution } from './project-home-contribution';
import { ProjectHomeWidget } from './project-home-widget';
import { ModelsWidget } from './models-widget';
import { ModelsViewContribution } from './models-view-contribution';
import { SkillsWidget } from './skills-widget';
import { SkillsViewContribution } from './skills-view-contribution';
import { ConnectionsWidget } from './connections-widget';
import { ConnectionsViewContribution } from './connections-view-contribution';
import { GameCrafterSettingsWidget } from './settings-widget';
import { SettingsViewContribution } from './settings-view-contribution';
import { TaskQuestionHandler } from './task-question-handler';
import { ToolApprovalHandler } from './tool-approval-handler';
import '../../src/browser/style/index.css';

export default new ContainerModule((bind) => {
  bind(ControlRoomClientEvents).toSelf().inSingletonScope();
  bind(ControlRoomClientToken).toService(ControlRoomClientEvents);
  bind(ControlRoomService)
    .toDynamicValue(({ container }) =>
      ServiceConnectionProvider.createProxy<ControlRoomService>(
        container,
        CONTROL_ROOM_SERVICE_PATH,
        container.get(ControlRoomClientToken),
      ),
    )
    .inSingletonScope();

  bind(ProjectHomeWidget).toSelf().inSingletonScope();
  bind(GameCrafterSettingsWidget).toSelf().inSingletonScope();
  bind(ModelsWidget).toSelf().inSingletonScope();
  bind(SkillsWidget).toSelf().inSingletonScope();
  bind(ConnectionsWidget).toSelf().inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ProjectHomeWidget.ID,
      createWidget: () => context.container.get(ProjectHomeWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: GameCrafterSettingsWidget.ID,
      createWidget: () => context.container.get(GameCrafterSettingsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ModelsWidget.ID,
      createWidget: () => context.container.get(ModelsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SkillsWidget.ID,
      createWidget: () => context.container.get(SkillsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ConnectionsWidget.ID,
      createWidget: () => context.container.get(ConnectionsWidget),
    }))
    .inSingletonScope();
  bindViewContribution(bind, ProjectHomeContribution);
  bind(FrontendApplicationContribution).toService(ProjectHomeContribution);
  bindViewContribution(bind, SettingsViewContribution);
  bindViewContribution(bind, ModelsViewContribution);
  bindViewContribution(bind, SkillsViewContribution);
  bindViewContribution(bind, ConnectionsViewContribution);
  bind(TaskQuestionHandler).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(TaskQuestionHandler);
  bind(ToolApprovalHandler).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(ToolApprovalHandler);

  bind(CreateProjectCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CreateProjectCommand);
  bind(MenuContribution).toService(CreateProjectCommand);
});
