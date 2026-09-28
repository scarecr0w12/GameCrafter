import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ProjectCreateInputSchema, projectManifest, type ProjectManifest } from './manifest';

const validManifest: ProjectManifest = {
  schemaVersion: 1,
  projectId: '019535d4-2c00-7000-8000-000000000001',
  name: 'Dungeon Test',
  description: '',
  engine: { family: 'godot' },
  genres: ['rpg'],
  modules: [],
  createdAt: '2026-01-01T12:00:00.000Z',
  createdByPlatformVersion: '0.1.0',
};

describe('project manifest contracts', () => {
  it('accepts a valid manifest literal', () => {
    expect(projectManifest.check(validManifest)).toBe(true);
  });

  it.each([
    ['missing engine family', { ...validManifest, engine: {} }],
    ['unknown engine family', { ...validManifest, engine: { family: 'unreal5' } }],
    ['unsupported schema version', { ...validManifest, schemaVersion: 2 }],
    ['unknown top-level property', { ...validManifest, extra: true }],
  ])('rejects %s', (_reason, value) => {
    expect(projectManifest.check(value)).toBe(false);
  });

  it('throws a readable validation error when asserting an invalid manifest', () => {
    expect(() => projectManifest.assert({ ...validManifest, schemaVersion: 2 })).toThrow(
      /schemaVersion/,
    );
  });

  it('accepts the minimal project create input', () => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    const validate = ajv.compile(ProjectCreateInputSchema);

    expect(
      validate({
        name: 'Dungeon Test',
        engine: { family: 'godot' },
        parentDirectory: '/tmp/x',
      }),
    ).toBe(true);
  });
});
