import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSource } from './skill-sources';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('skill source resolver', () => {
  it('resolves repository shorthands and GitHub/GitLab tree URLs', () => {
    expect(resolveSource('owner/repo')).toEqual({
      kind: 'git',
      url: 'https://github.com/owner/repo.git',
    });
    expect(resolveSource('https://github.com/owner/repo/tree/v2/skills/audit')).toEqual({
      kind: 'git',
      url: 'https://github.com/owner/repo.git',
      ref: 'v2',
      subpath: 'skills/audit',
    });
    expect(resolveSource('https://gitlab.com/owner/repo/-/tree/main/skills/audit')).toEqual({
      kind: 'git',
      url: 'https://gitlab.com/owner/repo.git',
      ref: 'main',
      subpath: 'skills/audit',
    });
    expect(resolveSource('git@github.com:owner/repo.git')).toEqual({
      kind: 'git',
      url: 'git@github.com:owner/repo.git',
    });
    expect(resolveSource('https://example.com/owner/repo.git#release-1')).toEqual({
      kind: 'git',
      url: 'https://example.com/owner/repo.git',
      ref: 'release-1',
    });
  });

  it('distinguishes local paths, direct skill files, and supported tar archives', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-skill-source-'));
    directories.push(directory);
    const skillFile = path.join(directory, 'SKILL.md');
    writeFileSync(skillFile, '---\nname: sample\ndescription: Sample skill.\n---\nBody\n');
    expect(resolveSource(directory)).toEqual({ kind: 'local', path: directory });
    expect(resolveSource(skillFile)).toEqual({ kind: 'local', path: skillFile });
    expect(resolveSource('https://example.test/skills/sample/SKILL.md')).toEqual({
      kind: 'skill-md-url',
      url: 'https://example.test/skills/sample/SKILL.md',
    });
    expect(resolveSource('https://example.test/downloads/skills.tgz?version=1')).toEqual({
      kind: 'archive-url',
      url: 'https://example.test/downloads/skills.tgz?version=1',
    });
    expect(resolveSource('https://example.test/downloads/skills.tar.gz')).toEqual({
      kind: 'archive-url',
      url: 'https://example.test/downloads/skills.tar.gz',
    });
  });

  it('rejects zip archives and identifies skills.sh packs for an unsupported installer result', () => {
    expect(() => resolveSource('https://example.test/skills.zip')).toThrowError(
      expect.objectContaining({ code: -32052, message: expect.stringContaining('.zip') }),
    );
    expect(resolveSource('https://skills.sh/p/example/skill')).toEqual({
      kind: 'skills-sh-pack',
      id: 'example/skill',
    });
  });
});
