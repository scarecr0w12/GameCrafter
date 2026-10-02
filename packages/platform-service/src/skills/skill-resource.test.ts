import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSkillDir } from './skill-loader';
import { readSkillResource } from './skill-resource';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-skill-resource-'));
  roots.push(root);
  const directory = path.join(root, 'guide');
  mkdirSync(path.join(directory, 'references'), { recursive: true });
  writeFileSync(
    path.join(directory, 'SKILL.md'),
    '---\nname: guide\ndescription: A guide.\n---\nInstructions.\n',
  );
  writeFileSync(path.join(directory, 'references/workflows.md'), 'first\r\nsecond\r\nthird\r\n');
  return { root, directory, skill: loadSkillDir(directory, 'platform', 'builtin:gamecrafter') };
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('skill resource reads', () => {
  it('returns bounded pages with inventory identity and a usable continuation', () => {
    const { skill } = fixture();
    const first = readSkillResource(skill, { resource: 'references/workflows.md', maxLines: 2 });
    expect(first).toEqual({
      schemaVersion: 1,
      name: 'guide',
      resource: 'references/workflows.md',
      hash: skill.hash,
      content: 'first\nsecond',
      startLine: 1,
      endLine: 2,
      totalLines: 3,
      truncated: true,
    });
    expect(
      readSkillResource(skill, { resource: first.resource, startLine: first.endLine + 1 }),
    ).toMatchObject({ content: 'third', endLine: 3, truncated: false });
    expect(readSkillResource(skill, { resource: 'SKILL.md' }).content).toContain('Instructions.');
  });
  it.each([
    '../secret.txt',
    '/etc/passwd',
    'references/../SKILL.md',
    'references\\workflows.md',
    'C:/secret',
    'references/missing.md',
  ])('rejects unlisted or unsafe paths: %s', (resource) => {
    expect(() => readSkillResource(fixture().skill, { resource })).toThrow();
  });
  it('rejects invalid pagination and an oversized/binary resource', () => {
    const { skill, directory } = fixture();
    for (const request of [
      { startLine: 0 },
      { startLine: 5 },
      { maxLines: 501 },
      { maxLines: -1 },
    ]) {
      expect(() =>
        readSkillResource(skill, { resource: 'references/workflows.md', ...request }),
      ).toThrow();
    }
    writeFileSync(
      path.join(directory, 'references/workflows.md'),
      Buffer.alloc(256 * 1024 + 1, 65),
    );
    expect(() => readSkillResource(skill, { resource: 'references/workflows.md' })).toThrow(
      '256 KiB',
    );
    writeFileSync(path.join(directory, 'references/workflows.md'), Buffer.from([0xff, 0xfe]));
    expect(() => readSkillResource(skill, { resource: 'references/workflows.md' })).toThrow(
      'UTF-8',
    );
    writeFileSync(path.join(directory, 'references/workflows.md'), 'text\0binary');
    expect(() => readSkillResource(skill, { resource: 'references/workflows.md' })).toThrow(
      'Binary',
    );
  });
  it.skipIf(process.platform === 'win32')(
    'rejects a resource replaced with an outside symlink',
    () => {
      const { skill, root, directory } = fixture();
      writeFileSync(path.join(root, 'secret.txt'), 'secret');
      const filename = path.join(directory, 'references/workflows.md');
      rmSync(filename);
      symlinkSync(path.join(root, 'secret.txt'), filename);
      expect(() => readSkillResource(skill, { resource: 'references/workflows.md' })).toThrow(
        'inside',
      );
    },
  );
  it('bounds response characters at complete lines and accepts an empty file', () => {
    const { skill, directory } = fixture();
    writeFileSync(
      path.join(directory, 'references/workflows.md'),
      Array(4).fill('a'.repeat(30000)).join('\n'),
    );
    const page = readSkillResource(skill, { resource: 'references/workflows.md' });
    expect(page.content.length).toBeLessThanOrEqual(65536);
    expect(page).toMatchObject({ endLine: 2, truncated: true });
    writeFileSync(path.join(directory, 'references/workflows.md'), 'a'.repeat(65536));
    expect(readSkillResource(skill, { resource: 'references/workflows.md' })).toMatchObject({
      endLine: 1,
      truncated: false,
    });
    writeFileSync(
      path.join(directory, 'references/workflows.md'),
      Array(3).fill('界'.repeat(10000)).join('\n'),
    );
    expect(
      Buffer.byteLength(readSkillResource(skill, { resource: 'references/workflows.md' }).content),
    ).toBeLessThanOrEqual(65536);
    writeFileSync(path.join(directory, 'references/workflows.md'), '');
    expect(readSkillResource(skill, { resource: 'references/workflows.md' })).toMatchObject({
      content: '',
      endLine: 0,
      totalLines: 0,
      truncated: false,
    });
  });
});
