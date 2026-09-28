import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { MessageService } from '@theia/core/lib/common/message-service';
import type { RpcNotificationParams } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

@injectable()
export class ToolApprovalHandler implements FrontendApplicationContribution {
  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    clientEvents: ControlRoomClientEvents,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {
    clientEvents.approvalRequested((event) => void this.handleApproval(event));
  }

  onStart(): void {}

  private async handleApproval(
    event: RpcNotificationParams<'broker/approvalRequested'>,
  ): Promise<void> {
    const { approval } = event;
    const answer = await this.messageService.warn(
      `Approve ${approval.toolId} (${approval.sideEffects})? ${approval.summary}`,
      'Approve',
      'Reject',
    );
    if (answer === undefined) return;
    try {
      await this.controlRoomService.approve(
        event.projectId,
        approval.approvalId,
        answer === 'Approve',
        `Selected ${answer}`,
      );
    } catch (error) {
      await this.messageService.error(error instanceof Error ? error.message : String(error));
    }
  }
}
