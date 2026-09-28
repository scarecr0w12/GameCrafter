import { setTimeout as delay } from 'node:timers/promises';
import { inject, injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { ControlRoomServiceImpl } from './control-room-service';

@injectable()
export class ControlRoomShutdownContribution implements BackendApplicationContribution {
  constructor(
    @inject(ControlRoomServiceImpl)
    private readonly controlRoomService: ControlRoomServiceImpl,
  ) {}

  async onStop(): Promise<void> {
    const timeout = new AbortController();
    try {
      await Promise.race([
        this.controlRoomService.stopServiceOnWindowClose(),
        delay(3000, undefined, { signal: timeout.signal }),
      ]);
    } catch {
      return;
    } finally {
      timeout.abort();
    }
  }
}
