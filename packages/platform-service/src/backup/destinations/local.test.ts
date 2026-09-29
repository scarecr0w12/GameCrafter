import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LocalBackupDestination } from './local';

describe('local backup destination', () => {
  it('atomically stores, lists, reads, probes, and deletes encrypted archives', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-local-test-'));
    const destinationDirectory = path.join(directory, 'archives');
    const sourcePath = path.join(directory, 'source.gcbackup');
    const contents = randomBytes(4096);
    await writeFile(sourcePath, contents);
    const destination = new LocalBackupDestination({ directory: destinationDirectory });
    const archiveName = 'profile-restore.gcbackup';
    try {
      await destination.put(archiveName, sourcePath);
      expect(await destination.list()).toMatchObject([{ archiveName, bytes: contents.length }]);
      const downloaded: Buffer[] = [];
      for await (const chunk of await destination.get(archiveName))
        downloaded.push(Buffer.from(chunk));
      expect(Buffer.concat(downloaded)).toEqual(contents);
      await destination.probe();
      await destination.delete(archiveName);
      expect(await destination.list()).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
