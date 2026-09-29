import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Mcp2026HttpFixture } from '../mcp/__fixtures__/server-2026-07-28';
import { startMcp2026HttpFixture } from '../mcp/__fixtures__/server-2026-07-28';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { RpcErrorCode, type EngineOperationRun } from '@gamecrafter/contracts';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let fixture: Mcp2026HttpFixture | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  await fixture?.close();
  fixture = undefined;
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('engine connector integration', () => {
  it('runs a real Godot capability, script-check, import, and version-mismatch flow', async (context) => {
    const godot = '/usr/local/bin/godot';
    if (!isExecutable(godot)) {
      console.warn(`Skipping real Godot connector test: ${godot} is not installed or executable.`);
      context.skip();
    }
    await startService('engine-godot-integration');
    const project = await client!.call('project/create', {
      name: 'Godot Connector Smoke',
      engine: { family: 'godot', preferredVersion: '4.7' },
      parentDirectory: path.join(temporaryDirectories[0]!, 'projects'),
      folderName: 'godot-connector-smoke',
    });
    const gamePath = path.join(project.path, 'game');
    writeFileSync(
      path.join(gamePath, 'project.godot'),
      'config_version=5\n[application]\nconfig/name="Smoke"\nconfig/features=PackedStringArray("4.7")\n',
    );
    writeFileSync(
      path.join(gamePath, 'main.gd'),
      'extends SceneTree\n\nfunc _initialize() -> void:\n    quit()\n',
    );

    const installations = await client!.call('engine/installations', { family: 'godot' });
    expect(
      installations.installations.some(
        (installation) => path.resolve(installation.executable) === godot,
      ),
    ).toBe(true);
    const initial = await client!.call('engine/capabilities', {
      projectId: project.projectId,
      refresh: true,
    });
    expect(initial).toMatchObject({
      family: 'godot',
      projectIdentity: { proven: true, projectVersion: '4.7' },
      layers: {
        'project-file': { status: 'ready' },
        'headless-process': { status: 'ready' },
        'live-editor': { status: 'unverified' },
      },
      engineVersion: {
        detected: expect.stringMatching(/^4\.7\.2/),
        preferred: '4.7',
        matches: true,
      },
    });
    expect(initial.operations.find((operation) => operation.operation === 'export')).toMatchObject({
      available: false,
      reason: 'No export_presets.cfg.',
    });

    const accepted = await client!.call('engine/run', {
      projectId: project.projectId,
      operation: 'check',
      params: { path: 'main.gd' },
    });
    expect(accepted).toMatchObject({ status: 'succeeded', exitCode: 0, operation: 'check' });

    const rejectedApproval = client!.call('engine/run', {
      projectId: project.projectId,
      operation: 'import',
    });
    const rejected = expect(rejectedApproval).rejects.toMatchObject({
      code: RpcErrorCode.ToolDenied,
    });
    const approval = await waitForPendingApproval(project.projectId);
    await client!.call('broker/approve', {
      projectId: project.projectId,
      approvalId: approval.approvalId,
      approve: false,
      reason: 'denied by user for the engine import test.',
    });
    await rejected;
    const cancelledRun = (
      await client!.call('engine/runs', { projectId: project.projectId })
    ).runs.find((run: EngineOperationRun) => run.operation === 'import');
    expect(cancelledRun).toMatchObject({ status: 'failed' });
    expect(cancelledRun?.summary).toContain('denied');

    await client!.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    const imported = await client!.call('engine/run', {
      projectId: project.projectId,
      operation: 'import',
    });
    expect(imported).toMatchObject({ status: 'succeeded', exitCode: 0, operation: 'import' });
    expect(statSync(path.join(gamePath, '.godot')).isDirectory()).toBe(true);

    writeFileSync(
      path.join(gamePath, 'broken.gd'),
      'extends Node\n\nfunc _ready() -> void:\n    var broken =\n',
    );
    const broken = await client!.call('engine/run', {
      projectId: project.projectId,
      operation: 'check',
      params: { path: 'broken.gd' },
    });
    expect(broken).toMatchObject({ status: 'failed', exitCode: expect.any(Number) });
    const stderr = readFileSync(
      path.join(
        project.path,
        broken.artifacts.find((artifact) => artifact.path.endsWith('stderr.log'))!.path,
      ),
      'utf8',
    );
    expect(stderr).toMatch(/parse|syntax|error/i);

    const manifestPath = path.join(project.path, 'gamecrafter.project.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.engine = { family: 'godot', preferredVersion: '4.3' };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const mismatch = await client!.call('engine/capabilities', {
      projectId: project.projectId,
      refresh: true,
    });
    expect(mismatch.engineVersion).toMatchObject({ preferred: '4.3', matches: false });
    const engineThread = (
      await client!.call('board/threads', { projectId: project.projectId })
    ).threads.find((thread) => thread.title === 'Engine');
    expect(engineThread).toBeDefined();
    await client!.call('engine/capabilities', { projectId: project.projectId, refresh: true });
    const threadDetails = await client!.call('board/thread', {
      projectId: project.projectId,
      threadId: engineThread!.threadId,
      includeMessages: true,
    });
    expect(threadDetails.messages).toHaveLength(1);
  }, 60_000);

  it('rejects engine execution when Project identity is unproven or the requested family mismatches', async () => {
    await startService('engine-identity-errors');
    const project = await client!.call('project/create', {
      name: 'Unidentified Unity Project',
      engine: { family: 'unity' },
      parentDirectory: path.join(temporaryDirectories[0]!, 'projects'),
      folderName: 'unidentified-unity',
    });
    await expect(
      client!.call('engine/run', { projectId: project.projectId, operation: 'build' }),
    ).rejects.toMatchObject({ code: RpcErrorCode.EngineProjectIdentityUnproven });
    await expect(
      client!.call('engine/run', {
        projectId: project.projectId,
        operation: 'check',
        params: { family: 'godot' },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.EngineFamilyMismatch });
  });

  it('binds a tagged MCP live bridge, routes screenshots, and blocks console in Restricted mode', async () => {
    await startService('engine-live-bridge-integration');
    const project = await client!.call('project/create', {
      name: 'Live Bridge Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(temporaryDirectories[0]!, 'projects'),
      folderName: 'live-bridge-project',
    });
    const gamePath = path.join(project.path, 'game');
    writeFileSync(
      path.join(gamePath, 'project.godot'),
      'config_version=5\n[application]\nconfig/name="Bridge"\nconfig/features=PackedStringArray("4.7")\n',
    );
    fixture = await startMcp2026HttpFixture(0, project.projectId);
    const connection = await client!.call('mcp/add', {
      config: {
        name: 'godot-editor',
        scope: 'project',
        projectId: project.projectId,
        mode: 'endpoint',
        endpoint: { url: fixture.url, transport: 'streamable-http', headers: {} },
        tags: ['live-editor'],
        enabled: false,
      },
    });
    await client!.call('mcp/connect', { connectionId: connection.connectionId });
    await client!.call('engine/setLiveBridge', {
      projectId: project.projectId,
      connectionId: connection.connectionId,
    });
    const report = await client!.call('engine/capabilities', {
      projectId: project.projectId,
      refresh: true,
    });
    expect(report.layers['live-editor'].status).toBe('ready');
    expect(report.liveBridge?.connectionId).toBe(connection.connectionId);
    expect(
      report.operations.find((operation) => operation.operation === 'screenshot'),
    ).toMatchObject({
      available: true,
      via: 'mcp',
      command: 'MCP godot-editor/screenshot',
    });
    const screenshot = await client!.call('engine/run', {
      projectId: project.projectId,
      operation: 'screenshot',
    });
    expect(screenshot).toMatchObject({ status: 'succeeded', operation: 'screenshot' });
    expect(screenshot.artifacts.some((artifact) => artifact.kind === 'screenshot')).toBe(true);

    await client!.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'restricted',
    });
    await expect(
      client!.call('engine/run', {
        projectId: project.projectId,
        operation: 'console',
        params: { command: 'print(1)' },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.ToolDenied });
    await client!.call('mcp/disconnect', { connectionId: connection.connectionId });
    const disconnected = await client!.call('engine/capabilities', {
      projectId: project.projectId,
      refresh: true,
    });
    expect(disconnected.layers['live-editor'].status).toBe('unavailable');
  }, 30_000);
});

async function startService(clientName: string): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-engine-service-'));
  temporaryDirectories.push(root);
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
  service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName,
    clientVersion: '0.1.0',
  });
}

async function waitForPendingApproval(projectId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const approvals = await client!.call('broker/approvals', { projectId, pendingOnly: true });
    const approval = approvals.approvals.find((entry) => entry.toolId === 'engine/import');
    if (approval) return approval;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Engine import approval was not requested');
}

function isExecutable(filePath: string): boolean {
  try {
    return (statSync(filePath).mode & 0o111) !== 0;
  } catch {
    return false;
  }
}
