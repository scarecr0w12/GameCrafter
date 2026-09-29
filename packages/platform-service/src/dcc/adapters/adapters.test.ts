import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type DccInstallation, type EngineRunArtifact } from '@gamecrafter/contracts';
import { parseGlbDocument, inspectGltfDocument } from '../../assets/preview/gltf-inspector';
import { requireExistingProjectPath, resolveProjectPath } from '../../assets/path-utils';
import { runEngineProcess } from '../../engines/process-runner';
import type { DccExecutionContext } from '../types';
import { BlenderAdapter } from './blender';
import { MayaAdapter } from './maya';
import { Max3DAdapter } from './3dsmax';
import { Cinema4DAdapter } from './cinema4d';
import { ZBrushAdapter } from './zbrush';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('DCC adapter fixtures', () => {
  it('discovers Blender and constructs inspect/export/render commands against the fake CLI', async () => {
    const { root, executable } = prepareFixture('blender', 'blender');
    const adapter = new BlenderAdapter();
    const installations = await adapter.detectInstallations({ PATH: path.dirname(executable) });
    const installation = installations.find((entry) => entry.executable === executable)!;
    expect(await adapter.probeVersion(installation)).toBe('5.2.2');
    const projectPath = path.join(root, 'project');
    mkdirSync(path.join(projectPath, 'game', 'assets'), { recursive: true });
    writeFileSync(path.join(projectPath, 'game', 'assets', 'fixture.blend'), 'fixture blend file');
    const context = executionContext(projectPath, installation);

    const discovered = await adapter.run('discover', {}, context);
    expect(discovered.status).toBe('succeeded');
    expect(discovered.summary).toContain('5.2.2');
    const inspected = await adapter.run('inspect', { file: 'game/assets/fixture.blend' }, context);
    expect(inspected.status).toBe('succeeded');
    expect(inspected.evidence.some((evidence) => evidence.detail.includes('"meshes":1'))).toBe(
      true,
    );
    const exported = await adapter.run(
      'export',
      { file: 'game/assets/fixture.blend', format: 'glb', output: 'game/assets/export.glb' },
      context,
    );
    expect(exported.status).toBe('succeeded');
    const glbPath = path.join(projectPath, 'game', 'assets', 'export.glb');
    const inspection = inspectGltfDocument(parseGlbDocument(readFileSync(glbPath)));
    expect(inspection.metadata.meshes).toBeGreaterThanOrEqual(1);
    const rendered = await adapter.run(
      'render-preview',
      { file: 'game/assets/fixture.blend' },
      context,
    );
    const pngArtifact = rendered.artifacts.find((artifact) => artifact.path.endsWith('.png'));
    expect(rendered.status).toBe('succeeded');
    expect(pngArtifact).toBeDefined();
    expect(readFileSync(path.join(projectPath, pngArtifact!.path)).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });

  it('constructs Maya mayapy arguments from the fake installation', async () => {
    const { root, executable } = prepareFixture('maya', 'mayapy');
    const adapter = new MayaAdapter();
    const installation = (
      await adapter.detectInstallations({ PATH: path.dirname(executable) })
    ).find((entry) => entry.executable === executable)!;
    expect(installation.kind).toBe('python');
    expect(await adapter.probeVersion(installation)).toBe('2025.1');
    const projectPath = makeProject(root, 'scene.ma');
    const outcome = await adapter.run(
      'inspect',
      { file: 'scene.ma' },
      executionContext(projectPath, installation),
    );
    expect(outcome.status).toBe('succeeded');
    expect(outcome.command).toContain(executable);
    expect(outcome.command.at(-1)).toMatch(/maya-inspect\.py$/);
  });

  it('uses 3dsmaxbatch script-file and sceneFile arguments against the fixture', async () => {
    const { root, executable } = prepareFixture('3dsmax', '3dsmaxbatch');
    const adapter = new Max3DAdapter();
    const installation = (
      await adapter.detectInstallations({ PATH: path.dirname(executable) })
    ).find((entry) => entry.executable === executable)!;
    expect(await adapter.probeVersion(installation)).toBe('2025.1');
    const projectPath = makeProject(root, 'scene.max');
    const outcome = await adapter.run(
      'inspect',
      { file: 'scene.max' },
      executionContext(projectPath, installation),
    );
    expect(outcome.status).toBe('succeeded');
    expect(outcome.command).toContain('-sceneFile');
    expect(outcome.command).toContain(path.join(projectPath, 'scene.max'));
  });

  it('uses c4dpy for Cinema 4D script operations against the fixture', async () => {
    const { root, executable } = prepareFixture('cinema4d', 'c4dpy');
    const adapter = new Cinema4DAdapter();
    const installation = (
      await adapter.detectInstallations({ PATH: path.dirname(executable) })
    ).find((entry) => entry.executable === executable)!;
    expect(await adapter.probeVersion(installation)).toBe('2026.1');
    const projectPath = makeProject(root, 'scene.c4d');
    const outcome = await adapter.run(
      'inspect',
      { file: 'scene.c4d' },
      executionContext(projectPath, installation),
    );
    expect(outcome.status).toBe('succeeded');
    expect(outcome.command).toContain(executable);
    expect(outcome.command.at(-1)).toMatch(/cinema4d-inspect\.py$/);
  });

  it('uses the ZBrush -script/-batch command shape against the fixture', async () => {
    const { root, executable } = prepareFixture('zbrush', 'ZBrush');
    const adapter = new ZBrushAdapter();
    const installation = (
      await adapter.detectInstallations({ PATH: path.dirname(executable) })
    ).find((entry) => entry.executable === executable)!;
    expect(await adapter.probeVersion(installation)).toBe('2026.1.0');
    const projectPath = makeProject(root, 'scene.zpr');
    const outcome = await adapter.run(
      'run-script',
      { script: 'print("fixture script")' },
      executionContext(projectPath, installation),
    );
    expect(outcome.status).toBe('succeeded');
    expect(outcome.command).toContain('-script');
    expect(outcome.command).toContain('-batch');
  });
});

function prepareFixture(
  tool: string,
  executableName: string,
): { root: string; executable: string } {
  const root = mkdtempSync(path.join(tmpdir(), `gc-dcc-${tool}-`));
  roots.push(root);
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const fixtures = path.resolve(__dirname, '../__fixtures__');
  const source = path.join(fixtures, `${tool}.cjs`);
  const executable = path.join(bin, executableName);
  cpSync(source, executable);
  chmodSync(executable, 0o755);
  return { root, executable };
}

function makeProject(root: string, fileName: string): string {
  const projectPath = path.join(root, 'project');
  mkdirSync(path.join(projectPath, '.gamecrafter'), { recursive: true });
  writeFileSync(path.join(projectPath, fileName), 'fixture scene');
  return projectPath;
}

function executionContext(projectPath: string, installation: DccInstallation): DccExecutionContext {
  const runId = uuidv7();
  const runDirectory = path.join(projectPath, '.gamecrafter', 'dcc-runs', runId);
  mkdirSync(runDirectory, { recursive: true });
  return {
    projectId: uuidv7(),
    projectPath,
    tool: installation.tool,
    installation,
    runId,
    runDirectory,
    startedAt: new Date().toISOString(),
    timeoutMs: 20_000,
    signal: new AbortController().signal,
    runProcess: (command, args, cwd = projectPath) =>
      runEngineProcess({
        command,
        args,
        cwd,
        projectPath,
        runDirectory,
        artifactRoot: `.gamecrafter/dcc-runs/${runId}`,
        timeoutMs: 20_000,
        signal: new AbortController().signal,
        redactCommand: (executable, commandArgs) => [executable, ...commandArgs],
      }),
    resolveInput: (relativePath) => requireExistingProjectPath(projectPath, relativePath),
    resolveOutput: (relativePath) => resolveProjectPath(projectPath, relativePath),
    toHostPath: async (filePath) => filePath,
    toWslPath: async (filePath) => filePath,
    writeArtifact: (kind, fileName, content) => {
      const safeName = path.basename(fileName);
      writeFileSync(path.join(runDirectory, safeName), content);
      return { kind, path: `.gamecrafter/dcc-runs/${runId}/${safeName}` } as EngineRunArtifact;
    },
    redactCommand: (command, args) => [command, ...args],
  };
}
