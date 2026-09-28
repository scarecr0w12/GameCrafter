import { describe, expect, it } from 'vitest';
import { RpcMethods } from '../rpc/protocol';
import { compile } from '../validation';
import {
  RoleFrontmatterSchema,
  RoleRecordSchema,
  SkillEnablementSchema,
  SkillFrontmatterSchema,
  SkillPlatformMetadataSchema,
} from './schema';

describe('skill and role contracts', () => {
  it('accepts forward-compatible Agent Skills frontmatter and string metadata', () => {
    const frontmatter = {
      name: 'godot-scene-audit',
      description: 'Audit Godot scenes for invalid nodes and scripts.',
      license: 'MIT',
      compatibility: 'Requires Godot 4.',
      'allowed-tools': 'fs/read-file, fs/list',
      metadata: {
        'gamecrafter-version': '1.2.0',
        'gamecrafter-engines': 'godot',
        'future-client-key': 'allowed',
      },
      'future-standard-field': 'ignored by other clients',
    };
    expect(compile(SkillFrontmatterSchema).check(frontmatter)).toBe(true);
    expect(
      compile(SkillFrontmatterSchema).check({
        ...frontmatter,
        metadata: { 'gamecrafter-version': 2 },
      }),
    ).toBe(false);
    expect(
      compile(SkillFrontmatterSchema).check({ ...frontmatter, description: 'x'.repeat(1025) }),
    ).toBe(false);
  });

  it('validates normalized platform metadata and enablement overrides', () => {
    expect(
      compile(SkillPlatformMetadataSchema).check({
        version: '1.2.0',
        engines: ['godot', '*'],
        genres: ['rpg'],
        workTypes: ['validation', 'code-review'],
        roles: ['validator'],
        capabilities: ['fs.read:project'],
        minPlatform: '0.1',
      }),
    ).toBe(true);
    expect(
      compile(SkillEnablementSchema).check({
        name: 'godot-scene-audit',
        enabled: true,
        pinnedVersion: null,
        pinnedHash: null,
        roles: ['validator'],
        workTypes: null,
      }),
    ).toBe(true);
  });

  it('validates role frontmatter and normalized records', () => {
    expect(
      compile(RoleFrontmatterSchema).check({
        name: 'engine-engineer',
        description: 'Build and validate engine integration code.',
        'work-types': 'code, engine-integration',
        'requires-modules': 'gameplay',
        'model-pool': 'engineering',
        'max-access': 'restricted',
        tools: 'fs/read-file, fs/list',
        'disallowed-tools': 'fs/delete',
        skills: 'engine-test-guide',
        'mcp-servers': ['godot'],
        'max-turns': 40,
        memory: 'project',
        'board-subscriptions': 'engineering',
        isolation: 'worktree',
        locks: 'godot-editor',
      }),
    ).toBe(true);
    expect(
      compile(RoleRecordSchema).check({
        name: 'engine-engineer',
        description: 'Build and validate engine integration code.',
        workTypes: ['code', 'engine-integration'],
        requiresModules: ['gameplay'],
        modelPool: 'engineering',
        maxAccess: 'restricted',
        tools: ['fs/read-file', 'fs/list'],
        disallowedTools: ['fs/delete'],
        skills: ['engine-test-guide'],
        mcpServers: ['godot'],
        maxTurns: 40,
        memory: 'project',
        boardSubscriptions: ['engineering'],
        isolation: 'worktree',
        locks: ['godot-editor'],
        location: '/profile/roles/engine-engineer',
        scope: 'platform',
        systemPrompt: 'Follow the Project instructions.',
        hash: 'a'.repeat(64),
      }),
    ).toBe(true);
  });

  it('requires trust and exposes the skills RPC shapes', () => {
    expect(
      compile(RpcMethods['project/trust'].result).check({
        projectId: '019535d4-2c00-7000-8000-000000000601',
        name: 'Trusted project',
        description: '',
        engine: { family: 'godot' },
        genres: [],
        modules: [],
        path: '/tmp/trusted',
        createdAt: '2026-09-28T00:00:00.000Z',
        lastOpenedAt: null,
        trusted: true,
      }),
    ).toBe(true);
    expect(
      compile(RpcMethods['skills/activate'].params).check({
        projectId: '019535d4-2c00-7000-8000-000000000601',
        name: 'godot-scene-audit',
      }),
    ).toBe(true);
    expect(
      compile(RpcMethods['skills/activate'].result).check({
        content: 'wrapped skill',
        version: '1.2.0',
        dir: '/profile/skills/godot-scene-audit',
        resources: ['references/scenes.md'],
        alreadyActive: false,
      }),
    ).toBe(true);
  });
});
