import { describe, expect, it } from 'vitest';
import { createWslInterop, isWsl } from './wsl-interop';

describe('DCC WSL path interop', () => {
  it('detects WSL and caches host and Linux path conversions', async () => {
    const calls: Array<[string, string]> = [];
    const interop = createWslInterop({
      platform: 'linux',
      procVersion: 'Linux version 6.6.87.2-microsoft-standard-WSL2',
      pathCommand: async (direction, filePath) => {
        calls.push([direction, filePath]);
        return direction === '-w'
          ? `Z:${filePath.replaceAll('/', '\\')}`
          : filePath.replaceAll('Z:\\', '/').replaceAll('\\', '/');
      },
    });
    expect(isWsl('linux', 'Microsoft WSL2')).toBe(true);
    expect(interop.isWsl()).toBe(true);
    expect(await interop.toHostPath('/mnt/d/Blender/blender.exe')).toBe(
      'Z:\\mnt\\d\\Blender\\blender.exe',
    );
    expect(await interop.toHostPath('/mnt/d/Blender/blender.exe')).toBe(
      'Z:\\mnt\\d\\Blender\\blender.exe',
    );
    expect(await interop.toWslPath('Z:\\mnt\\d\\Blender\\blender.exe')).toBe(
      '/mnt/d/Blender/blender.exe',
    );
    expect(calls).toEqual([
      ['-w', '/mnt/d/Blender/blender.exe'],
      ['-u', 'Z:\\mnt\\d\\Blender\\blender.exe'],
    ]);
  });

  it('leaves paths unchanged outside WSL', async () => {
    const interop = createWslInterop({ platform: 'linux', procVersion: 'Linux kernel' });
    expect(interop.isWsl()).toBe(false);
    expect(await interop.toHostPath('/tmp/file.blend')).toBe('/tmp/file.blend');
    expect(await interop.toWslPath('C:\\file.blend')).toBe('C:\\file.blend');
  });
});
