import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compile,
  PluginManifestSchema,
  validatePluginManifest,
  type PluginManifest,
} from '@gamecrafter/contracts';

describe('Sample Hello plugin package', () => {
  it('publishes a valid capability-scoped declarative plugin manifest', () => {
    const manifest = JSON.parse(
      readFileSync(path.resolve(__dirname, '../gamecrafter-plugin.json'), 'utf8'),
    ) as PluginManifest;
    expect(compile(PluginManifestSchema).check(manifest)).toBe(true);
    expect(validatePluginManifest(manifest)).toEqual([]);
    expect(manifest.capabilities).toContain('fs.project.read');
    expect(manifest.contributes.tools.map((tool) => tool.toolId)).toContain('sample-hello/greet');
    expect(manifest.contributes.ui.panels.map((panel) => panel.kind)).toContain('declarative');
  });
});
