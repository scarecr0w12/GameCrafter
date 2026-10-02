import { injectable } from '@theia/core/shared/inversify';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { flushSync } from 'react-dom';

/** Keep field-backed controlled inputs in sync before React restores their DOM values. */
@injectable()
export abstract class ControlRoomReactWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('gamecrafter-surface-widget');
  }

  override update(): void {
    if (this.isDisposed) return;
    // Widget.update() queues a Lumino message. That is too late for React's
    // controlled input event handling, which restores values when the event ends.
    flushSync(() => this.onUpdateRequest(Widget.Msg.UpdateRequest));
  }
}
