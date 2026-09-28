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
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ProjectHomeWidget.ID,
      createWidget: () => context.container.get(ProjectHomeWidget),
    }))
    .inSingletonScope();
  bindViewContribution(bind, ProjectHomeContribution);
  bind(FrontendApplicationContribution).toService(ProjectHomeContribution);

  bind(CreateProjectCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CreateProjectCommand);
  bind(MenuContribution).toService(CreateProjectCommand);
});
