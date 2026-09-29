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
  private readonly approvalRequestedEmitter = new Emitter<
    RpcNotificationParams<'broker/approvalRequested'>
  >();
  private readonly approvalResolvedEmitter = new Emitter<
    RpcNotificationParams<'broker/approvalResolved'>
  >();
  private readonly toolCalledEmitter = new Emitter<RpcNotificationParams<'tool/called'>>();
  private readonly mcpStateChangedEmitter = new Emitter<
    RpcNotificationParams<'mcp/stateChanged'>
  >();
  private readonly mcpInputRequiredEmitter = new Emitter<
    RpcNotificationParams<'mcp/inputRequired'>
  >();
  private readonly boardThreadChangedEmitter = new Emitter<
    RpcNotificationParams<'board/threadChanged'>
  >();
  private readonly boardMessagePostedEmitter = new Emitter<
    RpcNotificationParams<'board/messagePosted'>
  >();
  private readonly boardDecisionChangedEmitter = new Emitter<
    RpcNotificationParams<'board/decisionChanged'>
  >();
  private readonly serviceStatusEmitter = new Emitter<{
    connected: boolean;
    message?: string;
  }>();

  readonly projectChanged = this.projectChangedEmitter.event;
  readonly settingsChanged = this.settingsChangedEmitter.event;
  readonly taskChanged = this.taskChangedEmitter.event;
  readonly taskQuestion = this.taskQuestionEmitter.event;
  readonly approvalRequested = this.approvalRequestedEmitter.event;
  readonly approvalResolved = this.approvalResolvedEmitter.event;
  readonly toolCalled = this.toolCalledEmitter.event;
  readonly mcpStateChanged = this.mcpStateChangedEmitter.event;
  readonly mcpInputRequired = this.mcpInputRequiredEmitter.event;
  readonly boardThreadChanged = this.boardThreadChangedEmitter.event;
  readonly boardMessagePosted = this.boardMessagePostedEmitter.event;
  readonly boardDecisionChanged = this.boardDecisionChangedEmitter.event;
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

  onApprovalRequested(event: RpcNotificationParams<'broker/approvalRequested'>): void {
    this.approvalRequestedEmitter.fire(event);
  }

  onApprovalResolved(event: RpcNotificationParams<'broker/approvalResolved'>): void {
    this.approvalResolvedEmitter.fire(event);
  }

  onToolCalled(event: RpcNotificationParams<'tool/called'>): void {
    this.toolCalledEmitter.fire(event);
  }

  onMcpStateChanged(event: RpcNotificationParams<'mcp/stateChanged'>): void {
    this.mcpStateChangedEmitter.fire(event);
  }

  onMcpInputRequired(event: RpcNotificationParams<'mcp/inputRequired'>): void {
    this.mcpInputRequiredEmitter.fire(event);
  }

  onBoardThreadChanged(event: RpcNotificationParams<'board/threadChanged'>): void {
    this.boardThreadChangedEmitter.fire(event);
  }

  onBoardMessagePosted(event: RpcNotificationParams<'board/messagePosted'>): void {
    this.boardMessagePostedEmitter.fire(event);
  }

  onBoardDecisionChanged(event: RpcNotificationParams<'board/decisionChanged'>): void {
    this.boardDecisionChangedEmitter.fire(event);
  }

  onServiceStatus(status: { connected: boolean; message?: string }): void {
    this.serviceStatusEmitter.fire(status);
  }
}
