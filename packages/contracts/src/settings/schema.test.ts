import { describe, expect, it } from 'vitest';
import { EffectiveValueSchema } from './schema';
import { compile } from '../validation';
import { Type } from '@sinclair/typebox';

describe('effective settings values', () => {
  it('validates the effective value and its source', () => {
    const effectiveValue = compile(EffectiveValueSchema(Type.String()));

    expect(effectiveValue.check({ value: 'dark', source: 'project' })).toBe(true);
    expect(effectiveValue.check({ value: 'dark', source: 'other' })).toBe(false);
  });
});
