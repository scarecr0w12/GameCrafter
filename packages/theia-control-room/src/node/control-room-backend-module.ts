import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler } from '@theia/core/lib/common/messaging';
import { RpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import {
  CONTROL_ROOM_SERVICE_PATH,
  type ControlRoomClient,
  ControlRoomService,
} from '../common/control-room-protocol';
import { PlatformServiceConnection } from './service-connection';
import { ControlRoomServiceImpl } from './control-room-service';

export default new ContainerModule((bind) => {
  bind(PlatformServiceConnection).toSelf().inSingletonScope();
  bind(ControlRoomServiceImpl).toSelf().inSingletonScope();
  bind(ControlRoomService).toService(ControlRoomServiceImpl);
  bind(ConnectionHandler)
    .toDynamicValue(
      (ctx) =>
        new RpcConnectionHandler<ControlRoomClient>(CONTROL_ROOM_SERVICE_PATH, (client) => {
          const service = ctx.container.get(ControlRoomServiceImpl);
          service.setClient(client);
          return service;
        }),
    )
    .inSingletonScope();
});
