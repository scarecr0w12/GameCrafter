import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { UpdateState } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';

@injectable()
export class UpdatesWidget extends ReactWidget {
  static readonly ID = 'gamecrafter.updates';

  private state?: UpdateState;
  private message = '';
  private busy = false;

  constructor(@inject(ControlRoomService) private readonly service: ControlRoomServiceApi) {
    super();
    this.id = UpdatesWidget.ID;
    this.title.label = 'Updates';
    this.title.iconClass = 'codicon codicon-sync';
    this.title.closable = true;
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const state = this.state;
    return (
      <main className="gamecrafter-updates gamecrafter-surface">
        <header className="gamecrafter-updates-header">
          <div>
            <h2>Updates</h2>
            <p>Review release compatibility and verification before opening an installer.</p>
          </div>
          <button
            type="button"
            className="theia-button"
            onClick={() => void this.check()}
            disabled={this.busy}
          >
            Check for updates
          </button>
        </header>
        {this.message && <p role="status">{this.message}</p>}
        {!state ? (
          <p>Loading update state…</p>
        ) : (
          <>
            <section className="gamecrafter-updates-section">
              <h3>Installed version</h3>
              <p>{state.currentVersion} · stable channel</p>
              <p>Last checked: {state.lastCheckedAt ?? 'Not checked yet'}</p>
              {state.error && <p role="alert">{state.error}</p>}
            </section>
            <section className="gamecrafter-updates-section">
              <h3>
                {state.available
                  ? `Version ${state.available.version} available`
                  : 'No update available'}
              </h3>
              {!state.available && !state.compatibility.ok && (
                <p role="alert">
                  The latest release is incompatible: {state.compatibility.reasons.join('; ')}
                </p>
              )}
              {state.available && (
                <>
                  <p>{state.available.notes || 'No release notes provided.'}</p>
                  <p>
                    Package: {state.available.asset.name} ({state.available.asset.kind},{' '}
                    {state.available.asset.bytes} bytes)
                  </p>
                  <p>
                    Compatibility:{' '}
                    {state.compatibility.ok ? 'compatible' : state.compatibility.reasons.join('; ')}
                  </p>
                  <div className="gamecrafter-updates-actions">
                    <button
                      type="button"
                      onClick={() => void this.download()}
                      disabled={this.busy || !state.compatibility.ok}
                    >
                      Download and verify
                    </button>
                    <button type="button" onClick={() => void this.dismiss()} disabled={this.busy}>
                      Dismiss this version
                    </button>
                  </div>
                </>
              )}
            </section>
            {state.downloaded && (
              <section className="gamecrafter-updates-section">
                <h3>Downloaded {state.downloaded.version}</h3>
                <p>SHA-256: {state.downloaded.verified.sha256 ? 'verified' : 'failed'}</p>
                <p>Release signature: {state.downloaded.verified.signature}</p>
                {state.downloaded.verified.signature === 'unavailable' && (
                  <p role="alert">
                    The release signature is unavailable. Configure the trusted signing key in
                    Settings before proceeding.
                  </p>
                )}
                {state.downloaded.verified.signature === 'failed' && (
                  <p role="alert">
                    Release signature verification failed. Do not install this package.
                  </p>
                )}
                <p>
                  Installation is never automatic. The instructions open after you choose to
                  install.
                </p>
                <button
                  type="button"
                  onClick={() => void this.install()}
                  disabled={
                    this.busy ||
                    !state.downloaded.verified.sha256 ||
                    state.downloaded.verified.signature !== 'verified'
                  }
                >
                  Show install instructions
                </button>
              </section>
            )}
            {state.previous && (
              <section className="gamecrafter-updates-section">
                <h3>Rollback package: {state.previous.version}</h3>
                <p>Rollback requires closing GameCrafter and manually reinstalling this package.</p>
                <button type="button" onClick={() => void this.rollback()} disabled={this.busy}>
                  Show rollback instructions
                </button>
              </section>
            )}
          </>
        )}
      </main>
    );
  }

  private async refresh(): Promise<void> {
    await this.perform(async () => {
      this.state = await this.service.getUpdateState();
    });
  }

  private async check(): Promise<void> {
    await this.perform(async () => {
      this.state = await this.service.checkUpdates();
      this.message = this.state.available
        ? `Version ${this.state.available.version} is available.`
        : 'No compatible update is available.';
    });
  }

  private async download(): Promise<void> {
    const version = this.state?.available?.version;
    if (!version) return;
    await this.perform(async () => {
      this.state = await this.service.downloadUpdate(version);
      this.message = `Version ${version} downloaded and SHA-256 verified.`;
    });
  }

  private async dismiss(): Promise<void> {
    const version = this.state?.available?.version;
    if (!version) return;
    await this.perform(async () => {
      this.state = await this.service.dismissUpdate(version);
      this.message = `Version ${version} dismissed.`;
    });
  }

  private async install(): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.installUpdate();
      this.message = result.instructions;
    });
  }

  private async rollback(): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.rollbackUpdate();
      this.message = result.instructions;
    });
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.message = '';
    this.update();
    try {
      await action();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }
}
