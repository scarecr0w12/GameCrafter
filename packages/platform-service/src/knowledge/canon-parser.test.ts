import { describe, expect, it } from 'vitest';
import { BUILTIN_RECORD_TYPES, RpcErrorCode } from '@gamecrafter/contracts';
import { CanonParser } from './canon-parser';

const indexedAt = '2026-09-29T12:00:00.000Z';
const parser = new CanonParser();

const markdown = `---
schemaVersion: 1
id: char.aria-vale
type: character
title: Aria Vale
status: accepted
module: story
tags: [protagonist]
references:
  - rel: located-in
    target: loc.harborfall
    confidence: 1
    source: author
provenance:
  - kind: user
    ref: user
    at: ${indexedAt}
---
Aria is a navigator from Harborfall.`;

describe('CanonParser', () => {
  it('parses canon front matter and preserves its markdown body', () => {
    const parsed = parser.parse(markdown, {
      path: 'docs/canon/characters/aria-vale.md',
      revision: 'worktree',
      active: true,
      indexedAt,
      recordTypes: BUILTIN_RECORD_TYPES,
    });

    expect(parsed.record).toMatchObject({
      schemaVersion: 1,
      id: 'char.aria-vale',
      type: 'character',
      title: 'Aria Vale',
      status: 'accepted',
      module: 'story',
      path: 'docs/canon/characters/aria-vale.md',
      revision: 'worktree',
      active: true,
      indexedAt,
    });
    expect(parsed.record.bodyExcerpt).toBe('Aria is a navigator from Harborfall.');
    expect(parsed.body).toBe('Aria is a navigator from Harborfall.');
    expect(parsed.record.references[0]).toMatchObject({
      rel: 'located-in',
      target: 'loc.harborfall',
      confidence: 1,
      source: 'author',
    });
  });

  it('accepts registered plugin types and rejects missing, malformed, or unknown records', () => {
    const custom = markdown.replace('type: character', 'type: creature');
    expect(() =>
      parser.parse(custom, {
        path: 'docs/canon/creatures/aria.md',
        revision: 'worktree',
        active: true,
        indexedAt,
        recordTypes: [...BUILTIN_RECORD_TYPES, 'creature'],
      }),
    ).not.toThrow();

    for (const invalid of [
      markdown.replace('id: char.aria-vale', 'id: Aria'),
      markdown.replace('id: char.aria-vale\n', ''),
      custom,
    ]) {
      expect(() =>
        parser.parse(invalid, {
          path: 'docs/canon/invalid.md',
          revision: 'worktree',
          active: true,
          indexedAt,
          recordTypes: BUILTIN_RECORD_TYPES,
        }),
      ).toThrow(expect.objectContaining({ code: RpcErrorCode.CanonRecordInvalid }));
    }
  });
});
