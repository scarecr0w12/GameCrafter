import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type EffectiveSetting } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import type { SettingsService } from '../settings/settings-service';
import { SkillInstaller } from './skill-installer';
import { SkillRegistry } from './skill-registry';

const directories: string[] = [];

function writeSkill(parent: string, name: string, version = '1.0.0') {
  const directory = path.join(parent, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Guide for ${name}.\nmetadata:\n  gamecrafter-version: "${version}"\n  gamecrafter-roles: engine-engineer\n  gamecrafter-work-types: code\n---\nUse AGENTS.md and the Project canon.\n`,
  );
  return directory;
}

function makeFixture(trusted: boolean) {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-skill-registry-'));
  directories.push(root);
  const profileDir = path.join(root, 'profile');
  const projectPath = path.join(root, 'project');
  const homeDir = path.join(root, 'home');
  for (const directory of [profileDir, projectPath, homeDir])
    mkdirSync(directory, { recursive: true });
  const projectId = uuidv7();
  const manifest = {
    schemaVersion: 1,
    projectId,
    name: 'Trust Test Project',
    description: '',
    engine: { family: 'godot' },
    genres: ['rpg'],
    modules: [],
    createdAt: '2026-09-28T00:00:00.000Z',
    createdByPlatformVersion: '0.1.0',
  };
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  mkdirSync(path.join(projectPath, '.gamecrafter'), { recursive: true });
  const profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const profile = new ProfileStore(profileDatabase);
  profile.register(summaryFromManifest(manifest, projectPath, null, trusted));
  const projectDatabases = new ProjectDatabases(profile);
  const projectDatabase = projectDatabases.get(projectId);
  const settingValues: Record<string, unknown> = { 'skills.compatibilityScan.enabled': true };
  const settings = {
    resolve(key: string): EffectiveSetting {
      const value = settingValues[key];
      return { key, value, source: 'default', layers: { default: value } } as EffectiveSetting;
    },
  } as Pick<SettingsService, 'resolve'>;
  const installer = new SkillInstaller(profileDatabase, profileDir, settings);
  const pluginSkillDirectories: Array<{ pluginId: string; directory: string }> = [];
  const registry = new SkillRegistry({
    profile,
    projectDatabases,
    installer,
    settings,
    homeDir,
    pluginSkillDirectories: () => pluginSkillDirectories,
  });
  return {
    root,
    profileDir,
    projectPath,
    homeDir,
    projectId,
    profileDatabase,
    projectDatabase,
    projectDatabases,
    profile,
    installer,
    registry,
    pluginSkillDirectories,
    close() {
      projectDatabases.close();
      profileDatabase.close();
    },
  };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('SkillRegistry', () => {
  it('loads plugin skills only while their plugin is enabled for the Project', () => {
    const fixture = makeFixture(true);
    try {
      const pluginSkill = writeSkill(path.join(fixture.root, 'plugin-skills'), 'plugin-guide');
      fixture.pluginSkillDirectories.push({ pluginId: 'sample-plugin', directory: pluginSkill });
      const entry = fixture.registry
        .listForProject(fixture.projectId)
        .find((skill) => skill.name === 'plugin-guide');
      expect(entry).toMatchObject({
        scope: 'platform',
        source: 'plugin:sample-plugin',
        enablement: { enabled: true },
      });
      expect(fixture.registry.activatableSkill(fixture.projectId, 'plugin-guide').location).toBe(
        pluginSkill,
      );
      expect(fixture.registry.readableSkillRoots(fixture.projectId)).toContain(pluginSkill);
      fixture.pluginSkillDirectories.splice(0);
      expect(
        fixture.registry
          .listForProject(fixture.projectId)
          .some((skill) => skill.name === 'plugin-guide'),
      ).toBe(false);
    } finally {
      fixture.close();
    }
  });

  it('merges scope precedence, reports shadowing once, gates untrusted activation, and records activation', async () => {
    const fixture = makeFixture(false);
    try {
      const platformSource = path.join(fixture.root, 'platform-source');
      writeSkill(platformSource, 'engine-guide');
      const [installed] = await fixture.installer.install(platformSource);
      const enabled = fixture.registry.enable(fixture.projectId, {
        name: 'engine-guide',
        enabled: true,
        roles: ['engine-engineer'],
        workTypes: null,
        pin: true,
      });
      expect(enabled).toMatchObject({
        enabled: true,
        roles: ['engine-engineer'],
        pinnedHash: installed.hash,
      });

      writeSkill(path.join(fixture.projectPath, '.agents', 'skills'), 'engine-guide', '2.0.0');
      writeSkill(path.join(fixture.projectPath, '.claude', 'skills'), 'engine-guide');
      writeSkill(path.join(fixture.homeDir, '.agents', 'skills'), 'engine-guide');
      const firstList = fixture.registry.listForProject(fixture.projectId);
      const local = firstList.find((skill) => skill.scope === 'project')!;
      const platform = firstList.find((skill) => skill.scope === 'platform')!;
      const compat = firstList.filter((skill) => skill.scope === 'compat');
      expect(local.warnings).toContain('project_untrusted');
      expect(platform.enablement).toMatchObject({ enabled: true, roles: ['engine-engineer'] });
      expect(platform.shadowedBy).toBe(local.location);
      expect(compat.every((skill) => skill.shadowedBy === local.location)).toBe(true);
      fixture.registry.listForProject(fixture.projectId);
      expect(
        fixture.projectDatabase
          .prepare("SELECT COUNT(*) AS count FROM events WHERE kind = 'skill.shadowed'")
          .get<{ count: number }>()?.count,
      ).toBe(3);
      expect(() =>
        fixture.registry.activate(fixture.projectId, 'engine-guide', uuidv7(), 'agent-1'),
      ).toThrowError(expect.objectContaining({ code: -32057 }));

      fixture.profile.setTrusted(fixture.projectId, true);
      const activation = await fixture.registry.activate(
        fixture.projectId,
        'engine-guide',
        '019535d4-2c00-7000-8000-000000000701',
        'agent-1',
      );
      expect(activation).toMatchObject({
        version: '2.0.0',
        dir: local.location,
        alreadyActive: false,
      });
      expect(activation.content).toContain(
        `<skill_content name="engine-guide" version="2.0.0" dir="${local.location}">`,
      );
      expect(activation.content).toContain('Use AGENTS.md and the Project canon.');
      const repeated = await fixture.registry.activate(
        fixture.projectId,
        'engine-guide',
        '019535d4-2c00-7000-8000-000000000701',
        'agent-1',
      );
      expect(repeated).toMatchObject({
        alreadyActive: true,
        content: 'Skill "engine-guide" is already loaded in this task.',
      });
      expect(fixture.registry.activations(fixture.projectId)).toHaveLength(1);
      expect(fixture.registry.readableSkillRoots(fixture.projectId)).toContain(
        path.join(fixture.profileDir, 'skills'),
      );
    } finally {
      fixture.close();
    }
  });
});
