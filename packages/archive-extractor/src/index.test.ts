import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Header } from 'tar';
import decompress from './index';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function archive(entries: Array<{ path: string; content?: string; target?: string }>): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const bytes = Buffer.from(entry.content ?? '');
    const header = new Header({
      path: entry.path,
      mode: 0o644,
      size: bytes.length,
      type: entry.target ? 'SymbolicLink' : 'File',
      linkpath: entry.target,
      mtime: new Date(0),
    });
    header.encode();
    blocks.push(header.block!);
    if (bytes.length) blocks.push(bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

describe('Theia archive extraction compatibility', () => {
  it('supports buffer inspection, filtering, and extraction through a callable CommonJS adapter', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-extractor-'));
    roots.push(root);
    const input = archive([
      { path: 'extension/package.json', content: '{"name":"fixture"}' },
      { path: 'extension/README.md', content: 'Fixture' },
    ]);
    const filtered = await decompress(input, {
      filter: (file) => file.path === 'extension/package.json',
    });
    expect(filtered.map((file) => file.path)).toEqual(['extension/package.json']);
    await decompress(input, root);
    expect(readFileSync(path.join(root, 'extension', 'README.md'), 'utf8')).toBe('Fixture');
  });

  it.skipIf(process.platform === 'win32')(
    'prevents a symlink chain from writing outside the extraction root',
    async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'gc-extractor-symlinks-'));
      roots.push(root);
      const output = path.join(root, 'output');
      const outside = path.join(root, 'outside');
      mkdirSync(output);
      mkdirSync(outside);
      const input = archive([
        { path: 'a', target: '.' },
        { path: 'a/b', target: '../outside' },
        { path: 'a/b/escaped.txt', content: 'must not escape' },
      ]);
      try {
        await decompress(input, output);
      } catch {
        /* Rejection is a valid fail-closed outcome. */
      }
      expect(existsSync(path.join(outside, 'escaped.txt'))).toBe(false);
    },
  );
});
