import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSkillDir, stripFrontmatter } from './skill-loader';

const directories: string[] = [];

function makeSkill(name: string, frontmatter = '', body = 'Skill instructions.') {
  const parent = mkdtempSync(path.join(tmpdir(), 'gc-skill-loader-'));
  const directory = path.join(parent, name);
  directories.push(parent);
  mkdirSync(directory);
  writeFileSync(path.join(directory, 'SKILL.md'), `---\n${frontmatter}\n---\n${body}\n`);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('skill loader', () => {
  it('loads Agent Skills frontmatter, platform metadata, and relative resources', () => {
    const directory = makeSkill(
      'godot-scene-audit',
      [
        'name: godot-scene-audit',
        'description: Audit Godot scenes before export.',
        'license: MIT',
        'allowed-tools: fs/read-file, fs/list',
        'metadata:',
        '  gamecrafter-version: "1.2.0"',
        '  gamecrafter-engines: "godot, *"',
        '  gamecrafter-work-types: validation,code-review',
        '  gamecrafter-capabilities: fs.read:project',
        '  gamecrafter-custom-key: keep-as-a-warning',
        'future-field: ignored by other clients',
      ].join('\n'),
    );
    mkdirSync(path.join(directory, 'references'));
    writeFileSync(path.join(directory, 'references', 'scenes.md'), 'Scene checklist.');
    const record = loadSkillDir(directory, 'platform', 'local:/tmp/godot-scene-audit');
    expect(record).toMatchObject({
      name: 'godot-scene-audit',
      scope: 'platform',
      source: 'local:/tmp/godot-scene-audit',
      version: '1.2.0',
      platform: {
        engines: ['godot', '*'],
        workTypes: ['validation', 'code-review'],
        capabilities: ['fs.read:project'],
      },
      resources: ['references/scenes.md'],
    });
    expect(record.warnings).toContain('Unknown frontmatter key: future-field');
    expect(record.warnings).toContain('Unknown platform metadata key: gamecrafter-custom-key');
  });

  it('rejects missing frontmatter, directory-name mismatch, invalid descriptions, and non-string metadata', () => {
    const noFrontmatter = mkdtempSync(path.join(tmpdir(), 'gc-skill-no-frontmatter-'));
    directories.push(noFrontmatter);
    writeFileSync(path.join(noFrontmatter, 'SKILL.md'), 'No frontmatter.');
    expect(() => loadSkillDir(noFrontmatter, 'project')).toThrowError(
      expect.objectContaining({ code: -32051 }),
    );

    const mismatched = makeSkill(
      'other-directory',
      'name: a-different-skill\ndescription: Mismatch.',
    );
    expect(() => loadSkillDir(mismatched, 'project')).toThrow(/directory/i);

    const tooLong = makeSkill('too-long', `name: too-long\ndescription: "${'x'.repeat(1025)}"`);
    expect(() => loadSkillDir(tooLong, 'project')).toThrow(/description/i);

    const invalidMetadata = makeSkill(
      'invalid-metadata',
      'name: invalid-metadata\ndescription: Invalid metadata.\nmetadata:\n  gamecrafter-version: 2',
    );
    expect(() => loadSkillDir(invalidMetadata, 'project')).toThrow(/metadata/i);
  });

  it('warns when the body exceeds 500 lines and hashes sorted paths and contents deterministically', () => {
    const body = Array.from({ length: 501 }, (_, index) => `line ${index}`).join('\n');
    const directory = makeSkill(
      'long-skill',
      'name: long-skill\ndescription: A long skill body.',
      body,
    );
    mkdirSync(path.join(directory, 'assets'));
    writeFileSync(path.join(directory, 'assets', 'b.txt'), 'B');
    writeFileSync(path.join(directory, 'assets', 'a.txt'), 'A');
    const first = loadSkillDir(directory, 'project');
    const second = loadSkillDir(directory, 'project');
    expect(first.warnings).toContain('Skill body exceeds 500 lines.');
    expect(first.hash).toBe(second.hash);
    writeFileSync(path.join(directory, 'assets', 'a.txt'), 'changed');
    expect(loadSkillDir(directory, 'project').hash).not.toBe(first.hash);
  });

  it('strips only a valid leading frontmatter block', () => {
    expect(stripFrontmatter('---\nname: example\n---\nBody\n')).toBe('Body\n');
    expect(stripFrontmatter('Body without frontmatter')).toBe('Body without frontmatter');
  });
});
