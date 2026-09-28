import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRoleDir } from './role-loader';

const directories: string[] = [];

function makeRole(name: string, frontmatter: string) {
  const parent = mkdtempSync(path.join(tmpdir(), 'gc-role-loader-'));
  const directory = path.join(parent, name);
  directories.push(parent);
  mkdirSync(directory);
  writeFileSync(
    path.join(directory, 'ROLE.md'),
    `---\n${frontmatter}\n---\nRead the Project AGENTS.md first.\n`,
  );
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('role loader', () => {
  it('normalizes role frontmatter into arrays and a system prompt', () => {
    const directory = makeRole(
      'engine-engineer',
      [
        'name: engine-engineer',
        'description: Implements engine integration code.',
        'work-types: code, engine-integration',
        'requires-modules: gameplay, engine',
        'model-pool: engineering',
        'max-access: restricted',
        'tools: fs/read-file, fs/list',
        'disallowed-tools: fs/delete, process/run',
        'skills: godot-scene-audit',
        'mcp-servers:',
        '  - godot',
        'max-turns: 40',
        'memory: project',
        'board-subscriptions: engineering, canon',
        'isolation: worktree',
        'locks: godot-editor, project-files',
      ].join('\n'),
    );
    const role = loadRoleDir(directory, 'platform');
    expect(role).toMatchObject({
      name: 'engine-engineer',
      workTypes: ['code', 'engine-integration'],
      requiresModules: ['gameplay', 'engine'],
      tools: ['fs/read-file', 'fs/list'],
      disallowedTools: ['fs/delete', 'process/run'],
      mcpServers: ['godot'],
      memory: 'project',
      boardSubscriptions: ['engineering', 'canon'],
      isolation: 'worktree',
      locks: ['godot-editor', 'project-files'],
      scope: 'platform',
      systemPrompt: 'Read the Project AGENTS.md first.\n',
    });
  });

  it('rejects marketplace roles with full access or inline MCP servers', () => {
    const full = makeRole(
      'untrusted-full',
      'name: untrusted-full\ndescription: A third-party role.\nwork-types: code\nmax-access: full',
    );
    expect(() => loadRoleDir(full, 'platform', 'plugin')).toThrowError(
      expect.objectContaining({ code: -32056 }),
    );
    const inlineMcp = makeRole(
      'untrusted-mcp',
      'name: untrusted-mcp\ndescription: A third-party role.\nwork-types: code\nmax-access: restricted\nmcp-servers:\n  - external-server',
    );
    expect(() => loadRoleDir(inlineMcp, 'platform', 'plugin')).toThrow(/mcp-servers/i);
  });

  it('rejects role name/directory mismatches and accepts the built-in scope', () => {
    const directory = makeRole(
      'directory-name',
      'name: role-name\ndescription: Role description.\nwork-types: code\nmax-access: restricted',
    );
    expect(() => loadRoleDir(directory, 'project')).toThrow(/directory/i);
    const builtin = makeRole(
      'validator',
      'name: validator\ndescription: Validates test evidence.\nwork-types: validation\nmax-access: restricted',
    );
    expect(loadRoleDir(builtin, 'builtin').scope).toBe('builtin');
  });
});
