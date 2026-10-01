import { injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common/event';
import type { RpcNotificationParams } from '@gamecrafter/contracts';
import type { ControlRoomClient } from '../common/control-room-protocol';

export const ControlRoomClientToken = Symbol('ControlRoomClient');

@injectable()
export class ControlRoomClientEvents implements ControlRoomClient {
  private readonly projectChangedEmitter = new Emitter<RpcNotificationParams<'project/changed'>>();
  private readonly modelDeltaEmitter = new Emitter<RpcNotificationParams<'model/delta'>>();
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
  private readonly pluginWorkerChangedEmitter = new Emitter<
    RpcNotificationParams<'plugin/workerChanged'>
  >();
  private readonly pluginChangedEmitter = new Emitter<RpcNotificationParams<'plugin/changed'>>();
  private readonly engineCapabilitiesChangedEmitter = new Emitter<
    RpcNotificationParams<'engine/capabilitiesChanged'>
  >();
  private readonly engineRunChangedEmitter = new Emitter<
    RpcNotificationParams<'engine/runChanged'>
  >();
  private readonly dccCapabilitiesChangedEmitter = new Emitter<
    RpcNotificationParams<'dcc/capabilitiesChanged'>
  >();
  private readonly dccRunChangedEmitter = new Emitter<RpcNotificationParams<'dcc/runChanged'>>();
  private readonly assetJobChangedEmitter = new Emitter<
    RpcNotificationParams<'asset/jobChanged'>
  >();
  private readonly backupRunChangedEmitter = new Emitter<
    RpcNotificationParams<'backup/runChanged'>
  >();
  private readonly knowledgeIndexChangedEmitter = new Emitter<
    RpcNotificationParams<'knowledge/indexChanged'>
  >();
  private readonly knowledgeRecordChangedEmitter = new Emitter<
    RpcNotificationParams<'knowledge/recordChanged'>
  >();
  private readonly changeLockChangedEmitter = new Emitter<
    RpcNotificationParams<'change/lockChanged'>
  >();
  private readonly changeIntegrationChangedEmitter = new Emitter<
    RpcNotificationParams<'change/integrationChanged'>
  >();
  private readonly changeRequestChangedEmitter = new Emitter<
    RpcNotificationParams<'change/requestChanged'>
  >();
  private readonly serviceStatusEmitter = new Emitter<{
    connected: boolean;
    message?: string;
  }>();

  readonly projectChanged = this.projectChangedEmitter.event;
  readonly modelDelta = this.modelDeltaEmitter.event;
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
  readonly pluginWorkerChanged = this.pluginWorkerChangedEmitter.event;
  readonly pluginChanged = this.pluginChangedEmitter.event;
  readonly engineCapabilitiesChanged = this.engineCapabilitiesChangedEmitter.event;
  readonly engineRunChanged = this.engineRunChangedEmitter.event;
  readonly dccCapabilitiesChanged = this.dccCapabilitiesChangedEmitter.event;
  readonly dccRunChanged = this.dccRunChangedEmitter.event;
  readonly assetJobChanged = this.assetJobChangedEmitter.event;
  readonly backupRunChanged = this.backupRunChangedEmitter.event;
  readonly knowledgeIndexChanged = this.knowledgeIndexChangedEmitter.event;
  readonly knowledgeRecordChanged = this.knowledgeRecordChangedEmitter.event;
  readonly changeLockChanged = this.changeLockChangedEmitter.event;
  readonly changeIntegrationChanged = this.changeIntegrationChangedEmitter.event;
  readonly changeRequestChanged = this.changeRequestChangedEmitter.event;
  readonly serviceStatus = this.serviceStatusEmitter.event;

  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void {
    this.projectChangedEmitter.fire(event);
  }

  onModelDelta(event: RpcNotificationParams<'model/delta'>): void {
    this.modelDeltaEmitter.fire(event);
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

  onPluginWorkerChanged(event: RpcNotificationParams<'plugin/workerChanged'>): void {
    this.pluginWorkerChangedEmitter.fire(event);
  }

  onPluginChanged(event: RpcNotificationParams<'plugin/changed'>): void {
    this.pluginChangedEmitter.fire(event);
  }

  onEngineCapabilitiesChanged(event: RpcNotificationParams<'engine/capabilitiesChanged'>): void {
    this.engineCapabilitiesChangedEmitter.fire(event);
  }

  onEngineRunChanged(event: RpcNotificationParams<'engine/runChanged'>): void {
    this.engineRunChangedEmitter.fire(event);
  }

  onDccCapabilitiesChanged(event: RpcNotificationParams<'dcc/capabilitiesChanged'>): void {
    this.dccCapabilitiesChangedEmitter.fire(event);
  }

  onDccRunChanged(event: RpcNotificationParams<'dcc/runChanged'>): void {
    this.dccRunChangedEmitter.fire(event);
  }

  onAssetJobChanged(event: RpcNotificationParams<'asset/jobChanged'>): void {
    this.assetJobChangedEmitter.fire(event);
  }

  onBackupRunChanged(event: RpcNotificationParams<'backup/runChanged'>): void {
    this.backupRunChangedEmitter.fire(event);
  }

  onKnowledgeIndexChanged(event: RpcNotificationParams<'knowledge/indexChanged'>): void {
    this.knowledgeIndexChangedEmitter.fire(event);
  }

  onKnowledgeRecordChanged(event: RpcNotificationParams<'knowledge/recordChanged'>): void {
    this.knowledgeRecordChangedEmitter.fire(event);
  }

  onChangeLockChanged(event: RpcNotificationParams<'change/lockChanged'>): void {
    this.changeLockChangedEmitter.fire(event);
  }

  onChangeIntegrationChanged(event: RpcNotificationParams<'change/integrationChanged'>): void {
    this.changeIntegrationChangedEmitter.fire(event);
  }

  onChangeRequestChanged(event: RpcNotificationParams<'change/requestChanged'>): void {
    this.changeRequestChangedEmitter.fire(event);
  }

  onServiceStatus(status: { connected: boolean; message?: string }): void {
    this.serviceStatusEmitter.fire(status);
  }
}
