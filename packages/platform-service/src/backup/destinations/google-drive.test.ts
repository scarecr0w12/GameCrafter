import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GoogleDriveBackupDestination } from './google-drive';

describe('Google Drive backup destination', () => {
  it('refreshes OAuth credentials and completes resumable upload, list, download, and delete', async () => {
    const files = new Map<string, { name: string; bytes: Buffer; modifiedTime: string }>();
    const sessions = new Map<string, { name: string; chunks: Buffer[]; received: number }>();
    let refreshCount = 0;
    let sessionCount = 0;
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      if (url.pathname === '/token' && request.method === 'POST') {
        refreshCount += 1;
        const form = new URLSearchParams(body.toString('utf8'));
        if (form.get('refresh_token') !== 'refresh-secret') {
          response.writeHead(400).end();
          return;
        }
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ access_token: 'access-token', expires_in: 3600 }));
        return;
      }
      if (request.headers.authorization !== 'Bearer access-token') {
        response.writeHead(401).end();
        return;
      }
      if (url.pathname === '/upload/drive/v3/files' && request.method === 'POST') {
        const metadata = JSON.parse(body.toString('utf8')) as { name: string; parents: string[] };
        if (metadata.parents[0] !== 'folder-test') {
          response.writeHead(400).end();
          return;
        }
        const id = `file-${++sessionCount}`;
        sessions.set(id, { name: metadata.name, chunks: [], received: 0 });
        response
          .writeHead(200, {
            location: `http://127.0.0.1:${(server.address() as { port: number }).port}/upload/session/${id}`,
          })
          .end();
        return;
      }
      if (url.pathname.startsWith('/upload/session/') && request.method === 'PUT') {
        const id = url.pathname.split('/').at(-1)!;
        const session = sessions.get(id);
        if (!session) {
          response.writeHead(404).end();
          return;
        }
        session.chunks.push(body);
        session.received += body.length;
        const range = String(request.headers['content-range'] ?? '');
        const total = Number(range.split('/')[1]);
        if (session.received < total) {
          response.writeHead(308, { range: `bytes=0-${session.received - 1}` }).end();
          return;
        }
        files.set(id, {
          name: session.name,
          bytes: Buffer.concat(session.chunks),
          modifiedTime: '2026-09-29T12:00:00.000Z',
        });
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ id, name: session.name, size: String(session.received) }));
        return;
      }
      if (url.pathname === '/drive/v3/files' && request.method === 'GET') {
        const entries = [...files.entries()].filter(([, file]) => file.name.endsWith('.gcbackup'));
        response.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            files: entries.map(([id, file]) => ({
              id,
              name: file.name,
              size: String(file.bytes.length),
              modifiedTime: file.modifiedTime,
            })),
          }),
        );
        return;
      }
      const match = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
      if (match && request.method === 'GET' && url.searchParams.get('alt') === 'media') {
        const file = files.get(decodeURIComponent(match[1]!));
        if (!file) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, { 'content-length': String(file.bytes.length) }).end(file.bytes);
        return;
      }
      if (match && request.method === 'DELETE') {
        files.delete(decodeURIComponent(match[1]!));
        response.writeHead(204).end();
        return;
      }
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fake Drive server did not bind');
    const endpoint = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-drive-test-'));
    const sourcePath = path.join(directory, 'source.gcbackup');
    const contents = randomBytes(8 * 1024 * 1024 + 1024);
    await writeFile(sourcePath, contents);
    const destination = new GoogleDriveBackupDestination(
      {
        folderId: 'folder-test',
        clientId: 'client-id',
        tokenEndpoint: `${endpoint}/token`,
        apiEndpoint: endpoint,
      },
      { clientSecret: 'client-secret', refreshToken: 'refresh-secret' },
    );
    const archiveName = 'profile-test.gcbackup';
    try {
      await destination.put(archiveName, sourcePath);
      expect(sessions.get('file-1')?.chunks).toHaveLength(2);
      expect((await destination.list()).map((entry) => entry.archiveName)).toEqual([archiveName]);
      const downloaded: Buffer[] = [];
      for await (const chunk of await destination.get(archiveName))
        downloaded.push(Buffer.from(chunk));
      expect(Buffer.concat(downloaded)).toEqual(contents);
      expect(refreshCount).toBe(1);
      await destination.delete(archiveName);
      expect(await destination.list()).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }, 30_000);
});
