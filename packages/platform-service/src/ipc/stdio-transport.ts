import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from 'node:child_process';
import { TextDecoder } from 'node:util';
import { JsonRpcTransportError, type JsonRpcMessage, type JsonRpcTransport } from './types';

const maxFrameBytes = 10 * 1024 * 1024;

export interface StdioTransportOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  inheritEnv?: boolean;
  onStderr?: (line: string) => void;
  spawnProcess?: typeof spawn;
}

export class StdioTransport implements JsonRpcTransport {
  private child?: ChildProcessWithoutNullStreams;
  private onMessage?: (message: JsonRpcMessage) => void;
  private onError?: (error: Error) => void;
  private readonly stdoutDecoder = new TextDecoder();
  private readonly stderrDecoder = new TextDecoder();
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private closed = false;
  private closing?: Promise<void>;
  private exitPromise?: Promise<void>;
  private errorSent = false;

  constructor(private readonly options: StdioTransportOptions) {}

  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    if (this.child) throw new JsonRpcTransportError('JSON-RPC stdio transport is already started');
    this.onMessage = onMessage;
    this.onError = onError;
    const spawnOptions: SpawnOptions = {
      cwd: this.options.cwd,
      env:
        this.options.inheritEnv === false
          ? { ...this.options.env }
          : { ...process.env, ...this.options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    };
    const child = (this.options.spawnProcess ?? spawn)(
      this.options.command,
      this.options.args,
      spawnOptions,
    ) as ChildProcessWithoutNullStreams;
    this.child = child;
    this.exitPromise = new Promise<void>((resolve) => {
      child.once('close', () => resolve());
    });
    child.stdout.on('data', (chunk: Buffer | string) => this.readStdout(chunk));
    child.stderr.on('data', (chunk: Buffer | string) => this.readStderr(chunk));
    child.on('error', (error) => this.fail(error));
    child.once('close', (code, signal) => {
      this.stdoutBuffer += this.stdoutDecoder.decode();
      this.stderrBuffer += this.stderrDecoder.decode();
      this.flushStderr();
      if (!this.closed) {
        this.fail(
          new JsonRpcTransportError(
            `JSON-RPC stdio process exited${code === null ? '' : ` with code ${code}`}${signal ? ` (${signal})` : ''}`,
          ),
        );
      }
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve());
      child.once('error', reject);
    }).catch((error: unknown) => {
      this.fail(asError(error));
      throw new JsonRpcTransportError(`Unable to start command: ${asError(error).message}`, {
        cause: error,
      });
    });
  }

  async send(
    message: JsonRpcMessage,
    _options: { signal?: AbortSignal; rpcMethod?: string } = {},
  ): Promise<void> {
    void _options;
    const child = this.child;
    if (!child || this.closed || child.stdin.destroyed) {
      throw new JsonRpcTransportError('JSON-RPC stdio transport is not running');
    }
    const frame = `${JSON.stringify(message)}\n`;
    await new Promise<void>((resolve, reject) => {
      child.stdin.write(frame, (error) => (error ? reject(error) : resolve()));
    });
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.closing = this.closeProcess();
    return this.closing;
  }

  private async closeProcess(): Promise<void> {
    const child = this.child;
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.stdin.end();
      const timeout = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1_000);
        timer.unref?.();
      });
      await Promise.race([this.exitPromise, timeout]);
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
    await this.exitPromise;
  }

  private readStdout(chunk: Buffer | string): void {
    this.stdoutBuffer +=
      typeof chunk === 'string' ? chunk : this.stdoutDecoder.decode(chunk, { stream: true });
    if (Buffer.byteLength(this.stdoutBuffer, 'utf8') > maxFrameBytes) {
      this.fail(new JsonRpcTransportError('JSON-RPC stdio message exceeds the frame limit'));
      this.child?.kill();
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
          new JsonRpcTransportError(`Invalid JSON-RPC stdio frame: ${asError(error).message}`),
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
      this.options.onStderr?.(line);
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
