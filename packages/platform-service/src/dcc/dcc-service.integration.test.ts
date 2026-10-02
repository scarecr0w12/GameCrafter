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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let root: string | undefined;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'gc-dcc-service-integration-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'DCC connector integration',
    clientVersion: '0.1.0',
  });
});

afterEach(async () => {
  await client?.close();
  await service?.stop();
  client = undefined;
  service = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('DCC connector service integration', () => {
  it('adds an installation, reports capabilities, persists fake runs and enforces script policy', async () => {
    const project = await client!.call('project/create', {
      name: 'DCC Connector Fixture',
      engine: { family: 'godot' },
      parentDirectory: path.join(root!, 'projects'),
      folderName: 'dcc-connector-fixture',
    });
    await client!.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    await client!.call('settings/set', {
      key: 'dcc.autoDetectInstallations',
      scope: 'platform',
      value: false,
    });
    const bin = path.join(root!, 'dcc-bin');
    mkdirSync(bin);
    const fake = path.join(__dirname, '__fixtures__', 'blender.cjs');
    const executable = path.join(bin, 'blender');
    cpSync(fake, executable);
    chmodSync(executable, 0o755);
    const installation = await client!.call('dcc/addInstallation', {
      tool: 'blender',
      executable,
      kind: 'gui',
    });
    expect(installation).toMatchObject({
      tool: 'blender',
      kind: 'gui',
      version: '5.2.2',
      source: 'manual',
    });

    const report = await client!.call('dcc/capabilities', {
      projectId: project.projectId,
      tool: 'blender',
      refresh: true,
    });
    expect(report).toMatchObject({
      tool: 'blender',
      installation: { installationId: installation.installationId },
      layers: { headless: { status: 'ready' }, 'live-bridge': { status: 'unverified' } },
    });
    expect(report.operations.find((entry) => entry.operation === 'export')).toMatchObject({
      available: true,
      sideEffects: 'workspace-write',
    });

    mkdirSync(path.join(project.path, 'game', 'assets'), { recursive: true });
    writeFileSync(path.join(project.path, 'game', 'assets', 'fixture.blend'), 'fake blend scene');
    const discovery = await client!.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'discover',
    });
    expect(discovery).toMatchObject({
      status: 'succeeded',
      summary: expect.stringContaining('5.2.2'),
    });
    const inspected = await client!.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'inspect',
      params: { file: 'game/assets/fixture.blend' },
    });
    expect(inspected).toMatchObject({ status: 'succeeded', tool: 'blender', operation: 'inspect' });
    const escaped = await client!.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'inspect',
      params: { file: '../outside.blend' },
    });
    expect(escaped.status).toBe('failed');
    const exported = await client!.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'export',
      params: { file: 'game/assets/fixture.blend', format: 'glb', output: 'game/assets/fake.glb' },
    });
    expect(exported.status).toBe('succeeded');
    const preview = await client!.call('asset/preview', {
      projectId: project.projectId,
      path: 'game/assets/fake.glb',
    });
    expect(preview.metadata.meshes).toBeGreaterThanOrEqual(1);

    await expect(
      client!.call('dcc/run', {
        projectId: project.projectId,
        tool: 'blender',
        operation: 'run-script',
        params: { script: 'import subprocess\nsubprocess.run(["echo", "blocked"])' },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.DccScriptRejected });
    await client!.call('settings/set', {
      key: 'dcc.allowUnrestrictedScripts',
      scope: 'platform',
      value: true,
    });
    const scriptRun = await client!.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'run-script',
      params: { script: 'import subprocess\nsubprocess.run(["echo", "fixture"])' },
    });
    expect(scriptRun.status).toBe('succeeded');

    const runs = await client!.call('dcc/runs', {
      projectId: project.projectId,
      tool: 'blender',
      limit: 20,
    });
    expect(runs.runs.map((run) => run.operation)).toEqual(
      expect.arrayContaining(['discover', 'inspect', 'export', 'run-script']),
    );
    expect(
      await client!.call('dcc/run/get', { projectId: project.projectId, runId: scriptRun.runId }),
    ).toMatchObject({
      runId: scriptRun.runId,
      status: 'succeeded',
    });
    const unsupported = await client!.call('dcc/capabilities', {
      projectId: project.projectId,
      tool: '3dsmax',
      refresh: true,
    });
    expect(unsupported.layers.headless.status).toBe(
      process.platform === 'win32' ? 'unavailable' : 'unsupported-os',
    );
    expect(unsupported.operations.every((entry) => !entry.available)).toBe(true);
    expect(
      readFileSync(
        path.join(project.path, '.gamecrafter', 'dcc-runs', scriptRun.runId, 'stdout.log'),
        'utf8',
      ),
    ).toContain('GCDCC_JSON');
  }, 60_000);
});
