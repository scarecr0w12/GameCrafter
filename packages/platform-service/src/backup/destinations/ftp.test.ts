import { createServer, type Server, type Socket } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FtpBackupDestination } from './ftp';

describe('FTP backup destination', () => {
  it('uses passive binary storage, listing, retrieval, and delete commands', async () => {
    const files = new Map<string, Buffer>();
    const directories = new Set(['/']);
    const passiveServers = new Set<Server>();
    const controlSockets = new Set<Socket>();
    const control = createServer((socket) => {
      controlSockets.add(socket);
      socket.on('close', () => controlSockets.delete(socket));
      let currentDirectory = '/';
      let commandBuffer = '';
      let commandQueue = Promise.resolve();
      let dataServer: Server | undefined;
      let dataSocketPromise: Promise<Socket> | undefined;
      let resolveDataSocket: ((socket: Socket) => void) | undefined;
      const send = (message: string) => socket.write(`${message}\r\n`);
      const openPassive = async () => {
        dataSocketPromise = new Promise((resolve) => {
          resolveDataSocket = resolve;
        });
        dataServer = createServer((dataSocket) => resolveDataSocket?.(dataSocket));
        passiveServers.add(dataServer);
        await new Promise<void>((resolve) => dataServer!.listen(0, '127.0.0.1', resolve));
        const address = dataServer.address();
        if (!address || typeof address === 'string') throw new Error('No passive port');
        const p1 = Math.floor(address.port / 256);
        const p2 = address.port % 256;
        send(`227 Entering Passive Mode (127,0,0,1,${p1},${p2})`);
      };
      const closePassive = async () => {
        if (!dataServer) return;
        passiveServers.delete(dataServer);
        await new Promise<void>((resolve) => dataServer!.close(() => resolve()));
        dataServer = undefined;
      };
      const dataSocket = async () => {
        if (!dataSocketPromise) throw new Error('PASV was not negotiated');
        const result = await dataSocketPromise;
        dataSocketPromise = undefined;
        resolveDataSocket = undefined;
        return result;
      };
      const handle = async (line: string): Promise<void> => {
        const [verb = '', ...tail] = line.split(' ');
        const argument = tail.join(' ');
        if (verb === 'USER') return void send('331 password required');
        if (verb === 'PASS') return void send('230 logged in');
        if (verb === 'TYPE') return void send('200 binary');
        if (verb === 'CWD') {
          const target = path.posix.resolve(currentDirectory, argument || '/');
          if (!directories.has(target)) return void send('550 no such directory');
          currentDirectory = target;
          return void send('250 directory changed');
        }
        if (verb === 'MKD') {
          const target = path.posix.resolve(currentDirectory, argument);
          directories.add(target);
          return void send(`257 "${target}" created`);
        }
        if (verb === 'PASV') return openPassive();
        if (verb === 'STOR') {
          send('150 opening data connection');
          const data = await dataSocket();
          const chunks: Buffer[] = [];
          data.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          data.on('end', () => {
            files.set(path.posix.join(currentDirectory, argument), Buffer.concat(chunks));
            void closePassive().then(() => send('226 transfer complete'));
          });
          return;
        }
        if (verb === 'RETR') {
          const contents = files.get(path.posix.join(currentDirectory, argument));
          if (!contents) return void send('550 no such file');
          send('150 opening data connection');
          const data = await dataSocket();
          data.end(contents, () => void closePassive().then(() => send('226 transfer complete')));
          return;
        }
        if (verb === 'MLSD') {
          send('150 opening data connection');
          const data = await dataSocket();
          const rows = [...files.entries()]
            .filter(([name]) => path.posix.dirname(name) === currentDirectory)
            .map(
              ([name, contents]) =>
                `type=file;size=${contents.length};modify=20260929120000; ${path.posix.basename(name)}\r\n`,
            )
            .join('');
          data.end(rows, () => void closePassive().then(() => send('226 listing complete')));
          return;
        }
        if (verb === 'DELE') {
          files.delete(path.posix.join(currentDirectory, argument));
          return void send('250 deleted');
        }
        if (verb === 'QUIT') return void send('221 goodbye');
        send('502 unsupported');
      };
      socket.on('data', (chunk) => {
        commandBuffer += chunk.toString();
        const lines = commandBuffer.split(/\r?\n/);
        commandBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          commandQueue = commandQueue
            .then(() => handle(line))
            .catch((error: unknown) => {
              send(`550 ${error instanceof Error ? error.message : String(error)}`);
            });
        }
      });
      send('220 fake FTP ready');
    });
    await new Promise<void>((resolve) => control.listen(0, '127.0.0.1', resolve));
    const address = control.address();
    if (!address || typeof address === 'string') throw new Error('Fake FTP server did not bind');
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-ftp-test-'));
    const sourcePath = path.join(directory, 'source.gcbackup');
    const contents = randomBytes(2048);
    await writeFile(sourcePath, contents);
    const destination = new FtpBackupDestination(
      {
        host: '127.0.0.1',
        port: address.port,
        user: 'backup-user',
        directory: '/backups',
        secure: false,
      },
      { password: 'test-password' },
    );
    const archiveName = 'project-test.gcbackup';
    try {
      await destination.put(archiveName, sourcePath);
      expect(await destination.list()).toEqual([
        { archiveName, bytes: contents.length, modifiedAt: '2026-09-29T12:00:00.000Z' },
      ]);
      const downloaded: Buffer[] = [];
      for await (const chunk of await destination.get(archiveName))
        downloaded.push(Buffer.from(chunk));
      expect(Buffer.concat(downloaded)).toEqual(contents);
      await destination.delete(archiveName);
      expect(await destination.list()).toEqual([]);
    } finally {
      for (const socket of controlSockets) socket.destroy();
      for (const passiveServer of passiveServers)
        await new Promise<void>((resolve) => passiveServer.close(() => resolve()));
      await new Promise<void>((resolve) => control.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  });
});
