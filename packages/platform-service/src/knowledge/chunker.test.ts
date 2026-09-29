import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { Chunker } from './chunker';

const projectId = uuidv7();

describe('Chunker', () => {
  it('keeps Markdown headings at section boundaries and overlaps adjacent chunks', () => {
    const chunker = new Chunker({ maxChars: 52, overlapChars: 12 });
    const chunks = chunker.chunk({
      projectId,
      source: 'docs',
      path: 'docs/canon/notes.md',
      recordId: null,
      revision: 'worktree',
      text: '# Harborfall\n\nThe harbor is old and crowded.\n\nShips arrive before dawn.\n\n# North Gate\n\nThe gate opens at sunrise.',
    });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.text.length <= 52)).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes('# Harborfall'))).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes('# North Gate'))).toBe(true);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks.at(-1)?.endLine).toBe(9);
    expect(chunks[1]?.text.slice(0, 12)).toBe(chunks[0]?.text.slice(-12));
  });

  it('uses deterministic chunk ids and line ranges for code and plain text', () => {
    const chunker = new Chunker({ maxChars: 80, overlapChars: 0, maxCodeLines: 80 });
    const code = Array.from({ length: 83 }, (_, index) => `const value${index} = ${index};`).join(
      '\n',
    );
    const input = {
      projectId,
      source: 'code' as const,
      path: 'game/src/main.ts',
      recordId: null,
      revision: 'a'.repeat(40),
      text: code,
    };
    const first = chunker.chunk(input);
    const second = chunker.chunk(input);
    expect(first.map((chunk) => chunk.chunkId)).toEqual(second.map((chunk) => chunk.chunkId));
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({ startLine: 1, endLine: 80 });
    expect(first[1]).toMatchObject({ startLine: 81, endLine: 83 });

    const plain = new Chunker({ maxChars: 20, overlapChars: 0 }).chunk({
      ...input,
      source: 'assets',
      path: 'game/assets/readme.txt',
      text: 'first paragraph\n\nsecond paragraph',
    });
    expect(plain.map((chunk) => [chunk.startLine, chunk.endLine])).toEqual([
      [1, 1],
      [3, 3],
    ]);
  });
});
