import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { create as createTar } from 'tar';
import { afterEach, describe, expect, it } from 'vitest';
import type { EffectiveSetting } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import type { SettingsService } from '../settings/settings-service';
import { SkillInstaller } from './skill-installer';

const directories: string[] = [];

function makeFixture(limitMiB = 10) {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-skill-installer-'));
  directories.push(root);
  const profileDir = path.join(root, 'profile');
  mkdirSync(profileDir);
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const values: Record<string, unknown> = {
    'skills.installLimits.archiveMiB': limitMiB,
    'skills.installLimits.extractedMiB': 25,
    'skills.installLimits.maxFiles': 1000,
  };
  const settings = {
    resolve(key: string): EffectiveSetting {
      const value = values[key];
      return { key, value, source: 'default', layers: { default: value } } as EffectiveSetting;
    },
  } as Pick<SettingsService, 'resolve'>;
  return {
    root,
    profileDir,
    database,
    installer: new SkillInstaller(database, profileDir, settings),
  };
}

function writeSkill(parent: string, name: string, body = 'Installable skill.') {
  const directory = path.join(parent, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Skill ${name}.\nmetadata:\n  gamecrafter-version: "1.0.0"\n---\n${body}\n`,
  );
  return directory;
}

async function serve(file: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/gzip' });
    response.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Archive fixture server failed to bind');
  return {
    url: `http://127.0.0.1:${address.port}/skills.tgz`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('SkillInstaller', () => {
  it('selects one skill from a multi-skill local source, force-replaces it, and uninstalls it', async () => {
    const fixture = makeFixture();
    try {
      const source = path.join(fixture.root, 'repository');
      writeSkill(path.join(source, '.agents', 'skills'), 'skill-a', 'version one');
      writeSkill(path.join(source, '.agents', 'skills'), 'skill-b');
      await expect(fixture.installer.install(source)).rejects.toMatchObject({ code: -32051 });
      const [installed] = await fixture.installer.install(source, 'skill-a');
      expect(installed).toMatchObject({ name: 'skill-a', scope: 'platform', version: '1.0.0' });
      await expect(fixture.installer.install(source, 'skill-a')).rejects.toMatchObject({
        code: -32054,
      });

      writeFileSync(
        path.join(source, '.agents', 'skills', 'skill-a', 'SKILL.md'),
        '---\nname: skill-a\ndescription: Skill skill-a.\nmetadata:\n  gamecrafter-version: "2.0.0"\n---\nversion two\n',
      );
      const [replacement] = await fixture.installer.install(source, 'skill-a', true);
      expect(replacement.version).toBe('2.0.0');
      expect(replacement.hash).not.toBe(installed.hash);
      expect(
        fixture.database
          .prepare('SELECT previous_hash AS previousHash FROM installed_skills WHERE name = ?')
          .get<{ previousHash: string }>('skill-a')?.previousHash,
      ).toBe(installed.hash);
      fixture.installer.uninstall('skill-a');
      expect(fixture.database.prepare('SELECT name FROM installed_skills').all()).toEqual([]);
    } finally {
      fixture.database.close();
    }
  });

  it('enforces archive and extraction caps while downloading and extracting local HTTP fixtures', async () => {
    const fixture = makeFixture(1);
    const serverHandles: { close: () => Promise<void> }[] = [];
    try {
      const oversizedRoot = path.join(fixture.root, 'oversized');
      const oversizedSkill = writeSkill(oversizedRoot, 'too-large');
      writeFileSync(path.join(oversizedSkill, 'payload.bin'), randomBytes(1024 * 1024 + 2048));
      const oversizedArchive = path.join(fixture.root, 'oversized.tgz');
      await createTar({ cwd: oversizedRoot, file: oversizedArchive, gzip: true }, ['too-large']);
      const oversizedServer = await serve(oversizedArchive);
      serverHandles.push(oversizedServer);
      await expect(fixture.installer.install(oversizedServer.url)).rejects.toMatchObject({
        code: -32053,
      });

      const validRoot = path.join(fixture.root, 'valid');
      writeSkill(validRoot, 'archive-skill');
      const validArchive = path.join(fixture.root, 'valid.tgz');
      await createTar({ cwd: validRoot, file: validArchive, gzip: true }, ['archive-skill']);
      const validServer = await serve(validArchive);
      serverHandles.push(validServer);
      const [installed] = await fixture.installer.install(validServer.url);
      expect(installed.name).toBe('archive-skill');
    } finally {
      for (const server of serverHandles) await server.close();
      fixture.database.close();
    }
  });

  it('requires a name for multi-skill local Git repositories and records the checked-out commit', async () => {
    const fixture = makeFixture();
    try {
      const work = path.join(fixture.root, 'repo-work');
      const bare = path.join(fixture.root, 'repo.git');
      mkdirSync(work);
      writeSkill(path.join(work, 'skills'), 'git-skill-a');
      writeSkill(path.join(work, 'skills'), 'git-skill-b');
      execFileSync('git', ['init', '-b', 'main'], { cwd: work });
      execFileSync(
        'git',
        ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost', 'add', '-A'],
        { cwd: work },
      );
      execFileSync(
        'git',
        ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost', 'commit', '-m', 'skills'],
        { cwd: work },
      );
      execFileSync('git', ['clone', '--bare', work, bare]);
      await expect(fixture.installer.install(pathToFileURL(bare).toString())).rejects.toMatchObject(
        {
          code: -32051,
        },
      );
      const [installed] = await fixture.installer.install(
        pathToFileURL(bare).toString(),
        'git-skill-b',
      );
      expect(installed.name).toBe('git-skill-b');
      expect(installed.resolvedRef).toMatch(/^[a-f0-9]{40}$/);
    } finally {
      fixture.database.close();
    }
  });
});
