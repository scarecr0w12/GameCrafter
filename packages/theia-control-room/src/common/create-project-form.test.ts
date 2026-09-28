import { describe, expect, it } from 'vitest';
import { parseGenres } from './create-project-form';

describe('parseGenres', () => {
  it('trims, removes empty values, and deduplicates entries', () => {
    expect(parseGenres(' rpg, puzzle,, rpg, strategy ')).toEqual(['rpg', 'puzzle', 'strategy']);
  });
});
