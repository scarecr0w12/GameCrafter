import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_SKILL_NAMES } from './bundled-skill-names';
import { findBundledSkillsDirectory } from './skill-registry';
import { loadSkillDir, stripFrontmatter } from './skill-loader';
import { loadRoleDir } from '../roles/role-loader';

describe('bundled game-development library', () => {
  const root = findBundledSkillsDirectory();
  it('ships valid versioned skills and actual supporting references', () => {
    expect(new Set(BUNDLED_SKILL_NAMES).size).toBe(BUNDLED_SKILL_NAMES.length);
    for (const name of BUNDLED_SKILL_NAMES) {
      const record = loadSkillDir(path.join(root, name), 'platform', 'builtin:gamecrafter');
      expect(record, name).toMatchObject({
        name,
        version: '1.0.0',
        license: 'Apache-2.0',
        warnings: [],
      });
      expect(record.resources, name).toContain('references/workflows.md');
      const instructions = stripFrontmatter(
        readFileSync(path.join(record.location, 'SKILL.md'), 'utf8'),
      );
      expect(instructions.split('\n').length, name).toBeLessThanOrEqual(500);
      expect(instructions.length, name).toBeGreaterThan(2000);
      for (const resource of record.resources)
        expect(existsSync(path.join(record.location, resource)), `${name}/${resource}`).toBe(true);
    }
  });
  it('provides every skill recommended by a shipped role', () => {
    const roles = path.resolve(__dirname, '../../roles');
    for (const entry of readdirSync(roles, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const role = loadRoleDir(path.join(roles, entry.name), 'builtin');
      for (const name of role.skills)
        expect(BUNDLED_SKILL_NAMES, `${role.name}: ${name}`).toContain(name);
    }
  });
  it('copies the authored library into the standalone service build', () => {
    const packaged = path.resolve(__dirname, '../../lib/skills');
    const authored = path.resolve(__dirname, '../../../../.agents/skills');
    for (const name of BUNDLED_SKILL_NAMES) {
      for (const resource of ['SKILL.md', 'references/workflows.md']) {
        expect(
          readFileSync(path.join(packaged, name, resource), 'utf8'),
          `${name}/${resource}`,
        ).toBe(readFileSync(path.join(authored, name, resource), 'utf8'));
      }
    }
  });
  it('limits engine-specific skills to their intended family', () => {
    for (const [name, engine] of [
      ['unreal-development', 'unreal'],
      ['unity-development', 'unity'],
      ['godot-scene-audit', 'godot'],
    ]) {
      expect(
        loadSkillDir(path.join(root, name!), 'platform', 'builtin:gamecrafter').platform.engines,
      ).toEqual([engine]);
    }
  });
});
