import { injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common/event';
import type { RpcNotificationParams } from '@gamecrafter/contracts';
import type { ControlRoomClient } from '../common/control-room-protocol';

export const ControlRoomClientToken = Symbol('ControlRoomClient');

@injectable()
export class ControlRoomClientEvents implements ControlRoomClient {
  private readonly projectChangedEmitter = new Emitter<RpcNotificationParams<'project/changed'>>();
  private readonly serviceStatusEmitter = new Emitter<{
    connected: boolean;
    message?: string;
  }>();

  readonly projectChanged = this.projectChangedEmitter.event;
  readonly serviceStatus = this.serviceStatusEmitter.event;

  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void {
    this.projectChangedEmitter.fire(event);
  }

  onServiceStatus(status: { connected: boolean; message?: string }): void {
    this.serviceStatusEmitter.fire(status);
  }
}
