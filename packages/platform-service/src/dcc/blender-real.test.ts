import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { parseGlbDocument, inspectGltfDocument } from '../assets/preview/gltf-inspector';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';
import { wslInterop } from './wsl-interop';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let root: string | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('real Blender DCC connector', () => {
  it('discovers Blender, inspects a saved cube scene, exports GLB, and renders PNG through WSL interop', async (context) => {
    const blender = process.env.GAMECRAFTER_BLENDER ?? '/mnt/d/Blender/blender.exe';
    if (!existsSync(blender)) {
      console.warn(`Skipping real Blender connector test: ${blender} is not installed.`);
      context.skip();
    }
    root = mkdtempSync(path.join(tmpdir(), 'gc-dcc-blender-real-'));
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'real Blender connector test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Real Blender DCC Test',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'real-blender-dcc',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    const installations = await client.call('dcc/installations', { tool: 'blender' });
    let installation = installations.installations.find(
      (candidate) => path.resolve(candidate.executable) === path.resolve(blender),
    );
    if (!installation) {
      installation = await client.call('dcc/addInstallation', {
        tool: 'blender',
        executable: path.resolve(blender),
        kind: 'gui',
      });
    }
    expect(installation.version).toMatch(/^5\.2/);
    if (wslInterop.isWsl()) expect(installation.viaWslInterop).toBe(true);

    const capabilities = await client.call('dcc/capabilities', {
      projectId: project.projectId,
      tool: 'blender',
      refresh: true,
    });
    expect(capabilities.layers.headless.status).toBe('ready');
    const discovered = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'discover',
    });
    expect(discovered.status).toBe('succeeded');
    expect(discovered.summary).toContain('5.2');

    const blendPath = path.join(project.path, 'game', 'assets', 'wp16-real-cube.blend');
    mkdirSync(path.dirname(blendPath), { recursive: true });
    const hostBlendPath = await wslInterop.toHostPath(blendPath);
    const createSceneScript = [
      'import bpy',
      'bpy.ops.wm.read_factory_settings(use_empty=False)',
      `bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(hostBlendPath)})`,
    ].join('\n');
    const created = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'run-script',
      params: { script: createSceneScript },
    });
    expect(created.status).toBe('succeeded');
    expect(existsSync(blendPath)).toBe(true);

    const inspected = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'inspect',
      params: { file: 'game/assets/wp16-real-cube.blend' },
    });
    expect(inspected.status).toBe('succeeded');
    expect(
      inspected.evidence.some(
        (entry) => entry.detail.includes('"meshes": 1') || entry.detail.includes('"meshes":1'),
      ),
    ).toBe(true);

    const glbPath = path.join(project.path, 'game', 'assets', 'wp16-real-cube.glb');
    const exported = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'export',
      params: {
        file: 'game/assets/wp16-real-cube.blend',
        format: 'glb',
        output: 'game/assets/wp16-real-cube.glb',
      },
    });
    expect(exported.status).toBe('succeeded');
    const gltf = inspectGltfDocument(parseGlbDocument(readFileSync(glbPath)));
    expect(gltf.metadata.meshes).toBeGreaterThanOrEqual(1);

    const rendered = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'render-preview',
      params: { file: 'game/assets/wp16-real-cube.blend', resolution: 128, samples: 4 },
    });
    expect(rendered.command.join(' ')).not.toContain(path.basename(root));
    const renderLogs = [
      readFileSync(
        path.join(project.path, `.gamecrafter/dcc-runs/${rendered.runId}/stdout.log`),
        'utf8',
      ),
      readFileSync(
        path.join(project.path, `.gamecrafter/dcc-runs/${rendered.runId}/stderr.log`),
        'utf8',
      ),
    ].join('\n');
    expect(rendered.status, `${JSON.stringify(rendered, null, 2)}\n${renderLogs}`).toBe(
      'succeeded',
    );
    const pngArtifact = rendered.artifacts.find((artifact) => artifact.path.endsWith('.png'));
    expect(pngArtifact).toBeDefined();
    expect(readFileSync(path.join(project.path, pngArtifact!.path)).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }, 180_000);
});
