import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { TextDecoder } from 'node:util';
import { JsonRpcTransportError, type JsonRpcMessage, type JsonRpcTransport } from './types';

const maxFrameBytes = 10 * 1024 * 1024;

export class ChildProcessTransport implements JsonRpcTransport {
  private readonly exitPromise: Promise<void>;
  private readonly stdoutDecoder = new TextDecoder();
  private readonly stderrDecoder = new TextDecoder();
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private onMessage?: (message: JsonRpcMessage) => void;
  private onError?: (error: Error) => void;
  private closing?: Promise<void>;
  private closed = false;
  private errorSent = false;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly onStderr?: (line: string) => void,
  ) {
    this.exitPromise = new Promise((resolve) => child.once('close', () => resolve()));
  }

  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onError = onError;
    this.child.stdout.on('data', (chunk: Buffer | string) => this.readStdout(chunk));
    this.child.stderr.on('data', (chunk: Buffer | string) => this.readStderr(chunk));
    this.child.on('error', (error) => this.fail(error));
    this.child.once('close', (code, signal) => {
      this.stdoutBuffer += this.stdoutDecoder.decode();
      this.stderrBuffer += this.stderrDecoder.decode();
      this.flushStderr();
      if (!this.closed) {
        this.fail(
          new JsonRpcTransportError(
            `JSON-RPC child process exited${code === null ? '' : ` with code ${code}`}${signal ? ` (${signal})` : ''}`,
          ),
        );
      }
    });
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      this.fail(new JsonRpcTransportError('JSON-RPC child process exited before transport start'));
    }
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (this.closed || this.child.stdin.destroyed || this.child.exitCode !== null) {
      throw new JsonRpcTransportError('JSON-RPC child process is not running');
    }
    const frame = `${JSON.stringify(message)}\n`;
    await new Promise<void>((resolve, reject) => {
      this.child.stdin.write(frame, (error) => (error ? reject(error) : resolve()));
    });
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.closing = this.closeProcess();
    return this.closing;
  }

  private async closeProcess(): Promise<void> {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.stdin.end();
      await Promise.race([this.exitPromise, timeoutAfter(1_000)]);
      if (this.child.exitCode === null && this.child.signalCode === null) {
        this.child.kill('SIGTERM');
        await Promise.race([this.exitPromise, timeoutAfter(1_000)]);
      }
      if (this.child.exitCode === null && this.child.signalCode === null)
        this.child.kill('SIGKILL');
    }
    await this.exitPromise;
  }

  private readStdout(chunk: Buffer | string): void {
    this.stdoutBuffer +=
      typeof chunk === 'string' ? chunk : this.stdoutDecoder.decode(chunk, { stream: true });
    if (Buffer.byteLength(this.stdoutBuffer, 'utf8') > maxFrameBytes) {
      this.fail(new JsonRpcTransportError('JSON-RPC child message exceeds the frame limit'));
      this.child.kill();
      return;
    }
    for (;;) {
      const newline = this.stdoutBuffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      try {
        const message: unknown = JSON.parse(line);
        if (!isRecord(message)) throw new Error('JSON-RPC frame must be an object');
        this.onMessage?.(message);
      } catch (error) {
        this.fail(
          new JsonRpcTransportError(`Invalid JSON-RPC child frame: ${asError(error).message}`),
        );
      }
    }
  }

  private readStderr(chunk: Buffer | string): void {
    this.stderrBuffer +=
      typeof chunk === 'string' ? chunk : this.stderrDecoder.decode(chunk, { stream: true });
    for (;;) {
      const newline = this.stderrBuffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.stderrBuffer.slice(0, newline).replace(/\r$/, '');
      this.stderrBuffer = this.stderrBuffer.slice(newline + 1);
      this.reportStderr(line);
    }
  }

  private flushStderr(): void {
    if (!this.stderrBuffer) return;
    const line = this.stderrBuffer;
    this.stderrBuffer = '';
    this.reportStderr(line);
  }

  private reportStderr(line: string): void {
    try {
      this.onStderr?.(line);
    } catch {
      return;
    }
  }

  private fail(error: Error): void {
    if (this.errorSent || this.closed) return;
    this.errorSent = true;
    this.onError?.(error);
  }
}

function isRecord(value: unknown): value is JsonRpcMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function timeoutAfter(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}
