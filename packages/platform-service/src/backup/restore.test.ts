import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { removeRestoreStaging } from './restore';

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return { ...original, rmSync: vi.fn(original.rmSync) };
});

it('recovers from permission-denied staging cleanup without changing symlink targets', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'gc-cleanup-'));
  const staging = path.join(root, 'staging');
  const outside = path.join(root, 'outside');
  fs.mkdirSync(staging);
  fs.mkdirSync(outside);
  const outsideFile = path.join(outside, 'preserved');
  fs.writeFileSync(outsideFile, 'keep');
  fs.chmodSync(outsideFile, 0o444);
  fs.writeFileSync(path.join(staging, 'readonly'), 'temporary');
  fs.chmodSync(path.join(staging, 'readonly'), 0o444);
  fs.symlinkSync(
    outside,
    path.join(staging, 'link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const originalRm = vi.mocked(fs.rmSync).getMockImplementation()!;
  const remove = vi.mocked(fs.rmSync).mockImplementationOnce(() => {
    throw Object.assign(new Error('Permission denied'), { code: 'EPERM' });
  });
  try {
    removeRestoreStaging(staging);
    expect(fs.existsSync(staging)).toBe(false);
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe('keep');
    expect(fs.statSync(outsideFile).mode & 0o200).toBe(0);
    expect(remove).toHaveBeenCalledTimes(2);
  } finally {
    remove.mockReset().mockImplementation(originalRm);
    fs.chmodSync(outsideFile, 0o600);
    originalRm(root, { recursive: true, force: true });
  }
});
