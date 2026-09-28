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
export class TaskQuestionHandler implements FrontendApplicationContribution {
  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    clientEvents: ControlRoomClientEvents,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {
    clientEvents.taskQuestion((event) => void this.handleQuestion(event));
  }

  onStart(): void {}

  private async handleQuestion(event: RpcNotificationParams<'task/question'>): Promise<void> {
    if (event.question.options === null) return;
    const answer = await this.messageService.info(event.question.prompt, ...event.question.options);
    if (answer === undefined) return;
    try {
      await this.controlRoomService.answerQuestion(
        event.projectId,
        event.question.taskId,
        event.question.questionId,
        answer,
      );
    } catch (error) {
      await this.messageService.error(error instanceof Error ? error.message : String(error));
    }
  }
}
