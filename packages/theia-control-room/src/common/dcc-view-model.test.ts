import { describe, expect, it } from 'vitest';
import {
  buildDccParams,
  dccOperationFormFields,
  validateDccExecutable,
  validateProjectRelativePath,
} from './dcc-view-model';

describe('DCC view model', () => {
  it('validates absolute executable and contained Project paths', () => {
    expect(validateDccExecutable('')).toContain('absolute');
    expect(validateDccExecutable('blender')).toContain('absolute');
    expect(validateDccExecutable('/mnt/d/Blender/blender.exe')).toBeUndefined();
    expect(validateProjectRelativePath('')).toContain('Project-relative');
    expect(validateProjectRelativePath('../outside.blend')).toContain('escape');
    expect(validateProjectRelativePath('C:\\outside.blend')).toContain('absolute');
    expect(validateProjectRelativePath('game/assets/scene.blend')).toBeUndefined();
  });

  it('builds only the fields for the selected operation', () => {
    expect(dccOperationFormFields('discover')).toEqual([]);
    expect(
      buildDccParams('export', {
        file: 'game/scene.blend',
        format: 'glb',
        output: 'game/assets/scene.glb',
        script: 'ignored',
      }),
    ).toEqual({
      file: 'game/scene.blend',
      format: 'glb',
      output: 'game/assets/scene.glb',
    });
    expect(buildDccParams('run-script', { script: 'print("hello")', file: 'ignored' })).toEqual({
      script: 'print("hello")',
    });
  });
});
