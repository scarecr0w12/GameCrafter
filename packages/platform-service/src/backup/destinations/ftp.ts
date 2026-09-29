import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net, { type Socket } from 'node:net';
import tls, { type TLSSocket } from 'node:tls';
import { Readable, type Duplex } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { stat } from 'node:fs/promises';
import type { BackupArchiveEntry, BackupDestinationConfig } from '@gamecrafter/contracts';
import {
  assertArchiveName,
  type BackupDestinationAdapter,
  type BackupProgress,
} from './destination';

interface FtpReply {
  code: number;
  lines: string[];
}

interface FtpConfig {
  host: string;
  port: number;
  user: string;
  directory: string;
  secure: boolean;
}

export class FtpBackupDestination implements BackupDestinationAdapter {
  readonly kind = 'ftp' as const;
  private readonly config: FtpConfig;
  private readonly password: string;

  constructor(config: BackupDestinationConfig, secrets: Record<string, string>) {
    if (!('host' in config) || !('port' in config))
      throw new Error('Invalid FTP destination config');
    if (!secrets.password) throw new Error('FTP password is required');
    this.config = {
      host: config.host,
      port: config.port,
      user: config.user,
      directory: config.directory,
      secure: config.secure,
    };
    this.password = secrets.password;
  }

  async put(
    archiveName: string,
    sourceFilePath: string,
    onProgress?: BackupProgress,
    signal?: AbortSignal,
  ): Promise<{ bytes: number }> {
    assertArchiveName(archiveName);
    const session = await FtpSession.connect(this.config, this.password);
    try {
      await session.ensureDirectory(this.config.directory);
      const data = await session.openPassiveDataSocket();
      await session.expectCommand(`STOR ${safeName(archiveName)}`, [125, 150]);
      let transferred = 0;
      const source = createReadStream(sourceFilePath, { signal });
      source.on('data', (chunk) => {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        onProgress?.(transferred);
      });
      await pipeline(source, data, { signal });
      await session.readFinal([226, 250]);
      return { bytes: (await stat(sourceFilePath)).size };
    } finally {
      await session.close();
    }
  }

  async get(archiveName: string, signal?: AbortSignal): Promise<Readable> {
    assertArchiveName(archiveName);
    const session = await FtpSession.connect(this.config, this.password);
    let data: Duplex;
    try {
      await session.ensureDirectory(this.config.directory);
      data = await session.openPassiveDataSocket();
      await session.expectCommand(`RETR ${safeName(archiveName)}`, [125, 150]);
    } catch (error) {
      await session.close();
      throw error;
    }
    return Readable.from(
      (async function* () {
        let completed = false;
        try {
          for await (const chunk of data) {
            if (signal?.aborted) throw signal.reason;
            yield Buffer.from(chunk);
          }
          completed = true;
        } finally {
          try {
            if (completed) await session.readFinal([226, 250]);
            else data.destroy();
          } finally {
            await session.close();
          }
        }
      })(),
    );
  }

  async list(signal?: AbortSignal): Promise<BackupArchiveEntry[]> {
    if (signal?.aborted) throw signal.reason;
    const session = await FtpSession.connect(this.config, this.password);
    try {
      await session.ensureDirectory(this.config.directory);
      let listing: string[];
      try {
        listing = (await session.dataCommand('MLSD')).toString('utf8').split(/\r?\n/);
        const entries = listing
          .map(parseMlsdEntry)
          .filter((entry): entry is BackupArchiveEntry => entry !== undefined);
        if (entries.length > 0 || listing.every((line) => line.length === 0)) return entries;
      } catch {
        // Older servers may not implement MLSD.
      }
      listing = (await session.dataCommand('NLST')).toString('utf8').split(/\r?\n/);
      const entries: BackupArchiveEntry[] = [];
      for (const rawName of listing) {
        const archiveName = rawName.trim();
        if (!archiveName.endsWith('.gcbackup')) continue;
        const safe = safeName(archiveName);
        const sizeReply = await session.command(`SIZE ${safe}`);
        if (sizeReply.code !== 213) continue;
        const bytes = Number(sizeReply.lines.at(-1)?.slice(4).trim());
        if (Number.isSafeInteger(bytes) && bytes >= 0)
          entries.push({ archiveName, bytes, modifiedAt: null });
      }
      return entries;
    } finally {
      await session.close();
    }
  }

  async delete(archiveName: string): Promise<void> {
    assertArchiveName(archiveName);
    const session = await FtpSession.connect(this.config, this.password);
    try {
      await session.ensureDirectory(this.config.directory);
      await session.expectCommand(`DELE ${safeName(archiveName)}`, [250]);
    } finally {
      await session.close();
    }
  }

  async probe(): Promise<void> {
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-ftp-probe-'));
    const sourcePath = path.join(directory, 'probe.bin');
    const archiveName = `probe-${randomUUID()}.gcbackup`;
    const expected = Buffer.alloc(1024, 0x46);
    let uploaded = false;
    try {
      await writeFile(sourcePath, expected);
      await this.put(archiveName, sourcePath);
      uploaded = true;
      const stream = await this.get(archiveName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      if (!Buffer.concat(chunks).equals(expected)) throw new Error('FTP probe did not round-trip');
    } finally {
      if (uploaded) await this.delete(archiveName);
      await rm(directory, { recursive: true, force: true });
    }
  }
}

class FtpSession {
  private socket: Duplex;
  private buffer = '';
  private readonly lines: string[] = [];
  private readonly lineWaiters: Array<{
    resolve(line: string): void;
    reject(error: Error): void;
  }> = [];
  private readonly onData = (data: Buffer | string) => this.receive(data.toString());
  private readonly onError = (error: Error) => {
    for (const waiter of this.lineWaiters.splice(0)) waiter.reject(error);
  };

  private constructor(
    private readonly config: FtpConfig,
    socket: Duplex,
  ) {
    this.socket = socket;
    this.attach(socket);
  }

  static async connect(config: FtpConfig, password: string): Promise<FtpSession> {
    const plain = await connectSocket(config.host, config.port);
    const session = new FtpSession(config, plain);
    try {
      await session.readReply([220]);
      if (config.secure) {
        await session.expectCommand('AUTH TLS', [234]);
        session.detach(plain);
        const secureSocket = tls.connect({ socket: plain, servername: config.host });
        await waitForSocket(secureSocket, 'secureConnect');
        session.socket = secureSocket;
        session.attach(secureSocket);
        await session.expectCommand('PBSZ 0', [200]);
        await session.expectCommand('PROT P', [200]);
      }
      const userReply = await session.command(`USER ${safeCommand(config.user)}`);
      if (userReply.code === 331) {
        await session.expectCommand(`PASS ${safeCommand(password)}`, [230]);
      } else if (userReply.code !== 230) {
        throw replyError(userReply);
      }
      await session.expectCommand('TYPE I', [200]);
      return session;
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  async command(command: string): Promise<FtpReply> {
    if (/[\r\n]/.test(command)) throw new Error('Invalid FTP command argument');
    this.socket.write(`${command}\r\n`);
    return this.readReply();
  }

  async expectCommand(command: string, codes: number[]): Promise<FtpReply> {
    const reply = await this.command(command);
    if (!codes.includes(reply.code)) throw replyError(reply);
    return reply;
  }

  async readFinal(codes: number[]): Promise<FtpReply> {
    const reply = await this.readReply();
    if (!codes.includes(reply.code)) throw replyError(reply);
    return reply;
  }

  async ensureDirectory(directory: string): Promise<void> {
    if (!directory || directory === '.') return;
    const absolute = directory.startsWith('/');
    if (absolute) {
      const root = await this.command('CWD /');
      if (root.code !== 250) throw replyError(root);
    }
    for (const segment of directory.split('/').filter(Boolean)) {
      safeCommand(segment);
      const changed = await this.command(`CWD ${segment}`);
      if (changed.code === 250) continue;
      const created = await this.command(`MKD ${segment}`);
      if (![257, 550].includes(created.code)) throw replyError(created);
      await this.expectCommand(`CWD ${segment}`, [250]);
    }
  }

  async openPassiveDataSocket(): Promise<Duplex> {
    const reply = await this.expectCommand('PASV', [227]);
    const match = reply.lines
      .join(' ')
      .match(/\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})\)/);
    if (!match) throw new Error('FTP PASV response is invalid');
    const host = match.slice(1, 5).join('.');
    const port = Number(match[5]) * 256 + Number(match[6]);
    const socket = await connectSocket(host, port);
    if (!this.config.secure) return socket;
    const secureSocket = tls.connect({ socket: socket as Socket, servername: this.config.host });
    await waitForSocket(secureSocket, 'secureConnect');
    return secureSocket;
  }

  async dataCommand(command: string): Promise<Buffer> {
    const data = await this.openPassiveDataSocket();
    await this.expectCommand(command, [125, 150]);
    const chunks: Buffer[] = [];
    for await (const chunk of data) chunks.push(Buffer.from(chunk));
    await this.readFinal([226, 250]);
    return Buffer.concat(chunks);
  }

  async close(): Promise<void> {
    if (!this.socket.destroyed) {
      try {
        this.socket.write('QUIT\r\n');
      } catch {
        // The socket is closed below.
      }
      this.socket.destroy();
    }
    this.detach(this.socket);
  }

  private attach(socket: Duplex): void {
    socket.on('data', this.onData);
    socket.on('error', this.onError);
  }

  private detach(socket: Duplex): void {
    socket.off('data', this.onData);
    socket.off('error', this.onError);
  }

  private receive(value: string): void {
    this.buffer += value;
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      const waiter = this.lineWaiters.shift();
      if (waiter) waiter.resolve(line);
      else this.lines.push(line);
    }
  }

  private async readLine(): Promise<string> {
    const line = this.lines.shift();
    if (line !== undefined) return line;
    return new Promise((resolve, reject) => {
      this.lineWaiters.push({ resolve, reject });
    });
  }

  private async readReply(expectedCodes?: number[]): Promise<FtpReply> {
    const first = await this.readLine();
    const code = Number(first.slice(0, 3));
    if (!Number.isInteger(code)) throw new Error('FTP server sent an invalid reply');
    const lines = [first];
    if (first[3] === '-') {
      for (;;) {
        const line = await this.readLine();
        lines.push(line);
        if (line.startsWith(`${code} `)) break;
      }
    }
    const reply = { code, lines };
    if (expectedCodes && !expectedCodes.includes(code)) throw replyError(reply);
    return reply;
  }
}

function parseMlsdEntry(line: string): BackupArchiveEntry | undefined {
  const separator = line.indexOf(' ');
  if (separator <= 0) return undefined;
  const facts = line.slice(0, separator).toLowerCase();
  const archiveName = line.slice(separator + 1).trim();
  if (!archiveName.endsWith('.gcbackup') || facts.includes('type=dir')) return undefined;
  const size = Number(facts.match(/(?:^|;)size=(\d+)(?:;|$)/)?.[1]);
  if (!Number.isSafeInteger(size) || size < 0) return undefined;
  const modified = facts.match(/(?:^|;)modify=(\d{14})(?:;|$)/)?.[1];
  const modifiedAt = modified ? parseMlsdDate(modified) : null;
  return { archiveName, bytes: size, modifiedAt };
}

function parseMlsdDate(value: string): string | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeName(value: string): string {
  if (!/^[a-z0-9-_.]+$/i.test(value) || value.includes('..')) throw new Error('Invalid FTP name');
  return value;
}

function safeCommand(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('Invalid FTP command argument');
  return value;
}

function replyError(reply: FtpReply): Error {
  return new Error(`FTP destination returned ${reply.code}`);
}

function connectSocket(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host);
    const onError = (error: Error) => {
      socket.off('connect', onConnect);
      reject(error);
    };
    const onConnect = () => {
      socket.off('error', onError);
      resolve(socket);
    };
    socket.once('error', onError);
    socket.once('connect', onConnect);
  });
}

function waitForSocket(socket: TLSSocket, event: 'secureConnect'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      socket.off(event, onConnect);
      reject(error);
    };
    const onConnect = () => {
      socket.off('error', onError);
      resolve();
    };
    socket.once('error', onError);
    socket.once(event, onConnect);
  });
}
