import { mkdtempSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { renderProjectAgentsMd, ProjectWorkspace } from './workspace';
import type { ProjectManifest } from '@gamecrafter/contracts';

describe('Project instructions template', () => {
  it('states the locked engine family and operational database location', () => {
    const manifest: ProjectManifest = {
      schemaVersion: 1,
      projectId: '019535d4-2c00-7000-8000-000000000001',
      name: 'Dungeon Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: '2026-01-01T12:00:00.000Z',
      createdByPlatformVersion: '0.1.0',
    };

    const instructions = renderProjectAgentsMd(manifest);
    expect(instructions).toContain('godot');
    expect(instructions).toContain('Do not change');
    expect(instructions).toContain('.gamecrafter/project.sqlite');
    expect(instructions).toContain('not committed');
  });

  it('trusts platform-created Projects and leaves newly opened folders untrusted until confirmed', async () => {
    const parentDirectory = mkdtempSync(path.join(tmpdir(), 'gc-workspace-trust-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      const workspace = new ProjectWorkspace({ profile, platformVersion: '0.1.0' });
      const created = await workspace.create({
        name: 'Trusted Creation',
        engine: { family: 'godot' },
        parentDirectory,
      });
      expect(created.trusted).toBe(true);

      const importedPath = path.join(parentDirectory, 'imported-folder');
      mkdirSync(importedPath);
      const manifest: ProjectManifest = {
        schemaVersion: 1,
        projectId: '019535d4-2c00-7000-8000-000000000701',
        name: 'Imported Folder',
        description: '',
        engine: { family: 'godot' },
        genres: [],
        modules: [],
        createdAt: '2026-09-28T00:00:00.000Z',
        createdByPlatformVersion: '0.1.0',
      };
      writeFileSync(path.join(importedPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
      const imported = workspace.open(importedPath);
      expect(imported.trusted).toBe(false);
      expect(workspace.trust(imported.projectId, true).trusted).toBe(true);
      expect(workspace.get(imported.projectId).trusted).toBe(true);
    } finally {
      database.close();
      rmSync(parentDirectory, { recursive: true, force: true });
    }
  });

  it('removes a newly created Project folder when Git initialization fails', async () => {
    const parentDirectory = mkdtempSync(path.join(tmpdir(), 'gc-workspace-'));
    const projectPath = path.join(parentDirectory, 'dungeon-test');
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      const workspace = new ProjectWorkspace({
        profile,
        platformVersion: '0.1.0',
        git: {
          async run() {
            throw new Error('git failure');
          },
        },
      });

      await expect(
        workspace.create({
          name: 'Dungeon Test',
          engine: { family: 'godot' },
          parentDirectory,
        }),
      ).rejects.toThrow('git failure');
      expect(existsSync(projectPath)).toBe(false);
      expect(profile.list()).toEqual([]);
    } finally {
      database.close();
      rmSync(parentDirectory, { recursive: true, force: true });
    }
  });
});
