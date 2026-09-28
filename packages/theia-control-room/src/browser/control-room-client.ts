import { injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common/event';
import type { RpcNotificationParams } from '@gamecrafter/contracts';
import type { ControlRoomClient } from '../common/control-room-protocol';

export const ControlRoomClientToken = Symbol('ControlRoomClient');

@injectable()
export class ControlRoomClientEvents implements ControlRoomClient {
  private readonly projectChangedEmitter = new Emitter<RpcNotificationParams<'project/changed'>>();
  private readonly settingsChangedEmitter = new Emitter<
    RpcNotificationParams<'settings/changed'>
  >();
  private readonly taskChangedEmitter = new Emitter<RpcNotificationParams<'task/changed'>>();
  private readonly taskQuestionEmitter = new Emitter<RpcNotificationParams<'task/question'>>();
  private readonly serviceStatusEmitter = new Emitter<{
    connected: boolean;
    message?: string;
  }>();

  readonly projectChanged = this.projectChangedEmitter.event;
  readonly settingsChanged = this.settingsChangedEmitter.event;
  readonly taskChanged = this.taskChangedEmitter.event;
  readonly taskQuestion = this.taskQuestionEmitter.event;
  readonly serviceStatus = this.serviceStatusEmitter.event;

  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void {
    this.projectChangedEmitter.fire(event);
  }

  onSettingsChanged(event: RpcNotificationParams<'settings/changed'>): void {
    this.settingsChangedEmitter.fire(event);
  }

  onTaskChanged(event: RpcNotificationParams<'task/changed'>): void {
    this.taskChangedEmitter.fire(event);
  }

  onTaskQuestion(event: RpcNotificationParams<'task/question'>): void {
    this.taskQuestionEmitter.fire(event);
  }

  onServiceStatus(status: { connected: boolean; message?: string }): void {
    this.serviceStatusEmitter.fire(status);
  }
}
