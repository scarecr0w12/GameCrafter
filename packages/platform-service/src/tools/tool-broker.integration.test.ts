import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  uuidv7,
  type AccessMode,
  type ApprovalRequest,
  type TaskRecord,
} from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let projectId: string;
let projectPath: string;
let projectsDirectory: string;
let servicePaths: ServicePaths;

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-tool-broker-'));
  temporaryDirectories.push(root);
  const profilePath = path.join(root, 'profile');
  projectsDirectory = path.join(root, 'projects');
  mkdirSync(projectsDirectory, { recursive: true });
  servicePaths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profilePath }, 'linux');
  service = await startService(servicePaths);
  client = await connectToService(service.socketPath);
  const project = await client.call('project/create', {
    name: 'Tool Broker Project',
    engine: { family: 'godot' },
    parentDirectory: projectsDirectory,
    folderName: 'tool-project',
  });
  projectId = project.projectId;
  projectPath = project.path;
});

afterEach(async () => {
  client?.close();
  await service?.stop();
  service = undefined;
  client = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Tool broker integration', () => {
  it('lists the builtin tools with their execution metadata', async () => {
    const result = await client!.call('tool/list', { projectId });
    expect(result.tools).toHaveLength(23);
    expect(result.tools.map((tool) => tool.toolId)).toEqual([
      'board/post',
      'board/propose-decision',
      'board/read',
      'engine/build',
      'engine/check',
      'engine/console',
      'engine/discover',
      'engine/edit-scene',
      'engine/export',
      'engine/import',
      'engine/inspect',
      'engine/run',
      'engine/screenshot',
      'engine/test',
      'engine/validate',
      'fs/delete',
      'fs/list',
      'fs/read-file',
      'fs/write-file',
      'process/run',
      'project/manifest',
      'skills/activate',
      'skills/search',
    ]);
    expect(result.tools.find((tool) => tool.toolId === 'process/run')).toMatchObject({
      executionMode: 'headless-process',
      sideEffects: 'destructive',
      capabilities: ['process.spawn'],
      source: 'builtin',
    });
    expect(result.tools.find((tool) => tool.toolId === 'engine/check')).toMatchObject({
      executionMode: 'headless-process',
      sideEffects: 'none',
      source: 'builtin',
    });
    expect(result.tools.find((tool) => tool.toolId === 'engine/console')).toMatchObject({
      executionMode: 'live-editor',
      sideEffects: 'destructive',
      source: 'builtin',
    });
  }, 60_000);

  it('rejects traversal, outside symlinks, and filesystem writes into .git', async () => {
    await setSetting('access.mode', 'project', 'full');
    const outsidePath = path.join(path.dirname(projectsDirectory), 'outside.txt');
    writeFileSync(outsidePath, 'outside', 'utf8');
    await expect(callTool('fs/read-file', { path: '../../outside.txt' })).rejects.toMatchObject({
      code: -32034,
    });

    const symlinkPath = path.join(projectPath, 'outside-link.txt');
    try {
      symlinkSync(outsidePath, symlinkPath);
    } catch (error) {
      if (process.platform !== 'win32') throw error;
    }
    if (process.platform !== 'win32') {
      await expect(callTool('fs/read-file', { path: 'outside-link.txt' })).rejects.toMatchObject({
        code: -32034,
      });
    }

    await expect(
      callTool('fs/write-file', { path: '.git/config', content: 'unsafe' }),
    ).rejects.toMatchObject({ code: -32034 });
  }, 60_000);

  it('writes and reads Project files and records completed calls', async () => {
    await setSetting('access.mode', 'project', 'full');
    const written = await callTool('fs/write-file', {
      path: 'docs/notes.txt',
      content: 'hello',
      createDirectories: true,
    });
    const read = await callTool('fs/read-file', { path: 'docs/notes.txt' });
    expect(written.status).toBe('completed');
    expect(written.output).toEqual({ bytes: 5 });
    expect(read.output).toEqual({ content: 'hello', encoding: 'utf8', bytes: 5 });
    const calls = await client!.call('tool/calls', { projectId });
    expect(calls.calls).toHaveLength(2);
    expect(
      calls.calls.every((call) => call.status === 'completed' && call.decision === 'allowed'),
    ).toBe(true);
  }, 60_000);

  it('enforces restricted side effects and tool allowlists', async () => {
    await setSetting('access.mode', 'project', 'restricted');
    const write = await callTool('fs/write-file', { path: 'safe.txt', content: 'safe' });
    expect(write.status).toBe('completed');
    await expect(callTool('process/run', { command: 'echo', args: ['hi'] })).rejects.toMatchObject({
      code: -32031,
    });
    const denied = await client!.call('tool/calls', { projectId, toolId: 'process/run' });
    expect(denied.calls[0]).toMatchObject({ decision: 'denied', status: 'denied' });

    await setSetting('access.restricted.allowedTools', 'project', ['process/*']);
    const process = await callTool('process/run', {
      command: 'echo',
      args: ['hi'],
      timeoutMs: 5000,
    });
    expect(process.status).toBe('completed');
    expect(process.output).toMatchObject({ exitCode: 0, stdout: 'hi\n' });
  }, 60_000);

  it('allows no-effect reads and waits for reject/approve decisions', async () => {
    await setSetting('access.mode', 'project', 'ask-always');
    writeFileSync(path.join(projectPath, 'source.txt'), 'source', 'utf8');
    const read = await callTool('fs/read-file', { path: 'source.txt' });
    expect(read).toMatchObject({ decision: 'allowed', status: 'completed' });

    const rejectRequest = waitForApproval();
    let rejectSettled = false;
    const rejectedCall = callTool('fs/write-file', { path: 'rejected.txt', content: 'no' });
    void rejectedCall.then(
      () => (rejectSettled = true),
      () => (rejectSettled = true),
    );
    const rejectedApproval = await rejectRequest;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rejectSettled).toBe(false);
    expect(rejectedApproval.input).toMatchObject({ path: 'rejected.txt' });
    await expect(
      client!.call('broker/approvals', { projectId, pendingOnly: true }),
    ).resolves.toMatchObject({
      approvals: [expect.objectContaining({ approvalId: rejectedApproval.approvalId })],
    });
    await client!.call('broker/approve', {
      projectId,
      approvalId: rejectedApproval.approvalId,
      approve: false,
      reason: 'Not now',
    });
    await expect(rejectedCall).rejects.toMatchObject({ code: -32031 });
    const rejectedRecord = await client!.call('tool/calls', { projectId, toolId: 'fs/write-file' });
    expect(rejectedRecord.calls[0]).toMatchObject({ decision: 'rejected', status: 'rejected' });

    const approveRequest = waitForApproval();
    const approvedCall = callTool('fs/write-file', { path: 'approved.txt', content: 'yes' });
    const approvedApproval = await approveRequest;
    await client!.call('broker/approve', {
      projectId,
      approvalId: approvedApproval.approvalId,
      approve: true,
      reason: 'Approved for this task',
    });
    await expect(approvedCall).resolves.toMatchObject({
      decision: 'approved',
      status: 'completed',
    });
    await expect(
      client!.call('broker/approve', {
        projectId,
        approvalId: approvedApproval.approvalId,
        approve: true,
      }),
    ).rejects.toMatchObject({ code: -32035 });
    await expect(
      client!.call('broker/approve', { projectId, approvalId: uuidv7(), approve: true }),
    ).rejects.toMatchObject({ code: -32033 });
  }, 60_000);

  it('times out approvals using the injected timeout override', async () => {
    await restartService(200);
    await setSetting('access.mode', 'project', 'ask-always');
    await client!.call('settings/set', {
      key: 'access.askAlways.approvalTimeoutMinutes',
      scope: 'session',
      value: 1,
      sessionId: client!.sessionId,
    });
    const timedOut = await callTool('fs/write-file', { path: 'timeout.txt', content: 'wait' });
    expect(timedOut).toMatchObject({ decision: 'timed-out', status: 'timed-out' });
    const approvals = await client!.call('broker/approvals', { projectId });
    expect(approvals.approvals[0]).toMatchObject({
      approved: null,
      reason: 'Approval timed out',
    });
  }, 60_000);

  it('applies the most restrictive access ceiling', async () => {
    await client!.call('settings/set', {
      key: 'access.mode',
      scope: 'session',
      value: 'full',
      sessionId: client!.sessionId,
    });
    await expect(
      callTool('process/run', { command: 'echo', args: ['hi'] }, { accessCeiling: 'restricted' }),
    ).rejects.toMatchObject({ code: -32031 });
    const calls = await client!.call('tool/calls', { projectId, toolId: 'process/run' });
    expect(calls.calls[0]).toMatchObject({ accessMode: 'restricted', decision: 'denied' });
  }, 60_000);

  it('stores redacted tool inputs while writing the original file content', async () => {
    await setSetting('access.mode', 'project', 'full');
    const secretContent = `ghp_${'a'.repeat(30)}`;
    const call = await callTool('fs/write-file', { path: 'secret.txt', content: secretContent });
    expect(call.status).toBe('completed');
    expect(readFileSync(path.join(projectPath, 'secret.txt'), 'utf8')).toBe(secretContent);
    const persisted = await client!.call('tool/calls', { projectId, toolId: 'fs/write-file' });
    expect(persisted.calls[0]?.input).toMatchObject({ content: '[REDACTED]' });
  }, 60_000);

  it('exposes builtin tools to workers and enforces task access ceilings', async () => {
    await setSetting('access.mode', 'project', 'full');
    const manifestTask = await createTask({
      kind: 'noop.tool',
      title: 'Manifest tool',
      goal: 'Read Project manifest through the broker',
      input: { toolId: 'project/manifest', toolInput: {} },
    });
    const succeeded = await waitForTask(
      manifestTask.task.taskId,
      (task) => task.state === 'succeeded',
    );
    expect(succeeded.result?.summary).toContain('Tool Broker Project');
    const toolCalls = await client!.call('tool/calls', {
      projectId,
      taskId: manifestTask.task.taskId,
    });
    expect(toolCalls.calls).toMatchObject([{ toolId: 'project/manifest', status: 'completed' }]);
    const taskEvents = await client!.call('task/events', {
      projectId,
      taskId: manifestTask.task.taskId,
    });
    expect(taskEvents.events.some((event) => event.kind === 'tool.called')).toBe(true);

    const deniedTask = await createTask({
      kind: 'noop.tool',
      title: 'Restricted process tool',
      goal: 'Respect a restricted tool ceiling',
      assignee: { accessCeiling: 'restricted' },
      input: { toolId: 'process/run', toolInput: { command: 'echo', args: ['no'] } },
    });
    const failed = await waitForTask(deniedTask.task.taskId, (task) => task.state === 'failed');
    expect(failed.error?.message).toContain('not allowed in restricted mode');
    expect(failed.error?.code).toBe('-32031');
  }, 60_000);

  it('recovers pending approval rows and marks their abandoned calls service_restart', async () => {
    await setSetting('access.mode', 'project', 'ask-always');
    const approvalRequested = waitForApproval();
    const abandonedCall = callTool('fs/write-file', { path: 'pending.txt', content: 'approval' });
    const approval = await Promise.race([
      approvalRequested,
      abandonedCall.then(
        () => Promise.reject(new Error('Tool call completed before requesting approval')),
        (error) =>
          Promise.reject(
            new Error(`Tool call failed before requesting approval: ${String(error)}`),
          ),
      ),
    ]);
    void abandonedCall.catch(() => undefined);

    const stop = await client!.call('service/stop', { checkpoint: false });
    expect(stop.ok).toBe(true);
    await service!.stop(false);
    client?.close();
    client = undefined;

    service = await startService(servicePaths);
    client = await connectToService(service.socketPath);
    const calls = await client.call('tool/calls', { projectId, toolId: 'fs/write-file' });
    expect(calls.calls[0]).toMatchObject({
      callId: approval.callId,
      status: 'failed',
      error: { code: 'service_restart' },
    });
    const approvals = await client.call('broker/approvals', { projectId, pendingOnly: true });
    expect(approvals.approvals).toMatchObject([
      expect.objectContaining({ approvalId: approval.approvalId, resolvedAt: null }),
    ]);
  }, 60_000);

  it('writes one linked tool.called Project event for every final call', async () => {
    await setSetting('access.mode', 'project', 'full');
    await callTool('project/manifest', {});
    await callTool('fs/list', {});
    const calls = await client!.call('tool/calls', { projectId });
    const events = await client!.call('task/events', { projectId });
    const eventCallIds = events.events
      .filter((event) => event.kind === 'tool.called')
      .map((event) => (event.payload as { callId: string }).callId);
    expect(eventCallIds).toHaveLength(calls.calls.length);
    expect(new Set(eventCallIds)).toEqual(new Set(calls.calls.map((call) => call.callId)));
  }, 60_000);
});

async function startService(paths: ServicePaths, approvalTimeoutOverrideMs?: number) {
  return PlatformService.start({ paths, platformVersion: '0.1.0', approvalTimeoutOverrideMs });
}

async function restartService(approvalTimeoutOverrideMs: number): Promise<void> {
  const oldSocketPath = service!.socketPath;
  client?.close();
  client = undefined;
  await service!.stop();
  service = await startService(servicePaths, approvalTimeoutOverrideMs);
  if (service.socketPath !== oldSocketPath)
    throw new Error('Restart changed the service socket path');
  client = await connectToService(service.socketPath);
}

async function connectToService(socketPath: string): Promise<ServiceClient> {
  const token = readFileSync(servicePaths.tokenPath, 'utf8').trim();
  return connect({
    socketPath,
    token,
    clientName: 'tool-broker-integration',
    clientVersion: '0.1.0',
  });
}

async function setSetting(
  key: string,
  scope: 'project' | 'session',
  value: unknown,
): Promise<void> {
  await client!.call('settings/set', {
    key,
    scope,
    value,
    projectId,
    ...(scope === 'session' ? { sessionId: client!.sessionId } : {}),
  });
}

async function callTool(
  toolId: string,
  input: unknown,
  options: { taskId?: string; agentId?: string; accessCeiling?: AccessMode } = {},
) {
  return client!.call('tool/call', { projectId, toolId, input, ...options });
}

function waitForApproval(timeoutMs = 5000): Promise<ApprovalRequest> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Approval request notification was not received')),
      timeoutMs,
    );
    client!.onNotification('broker/approvalRequested', (event) => {
      if (event.projectId !== projectId) return;
      clearTimeout(timer);
      resolve(event.approval);
    });
  });
}

async function createTask(input: {
  kind: string;
  title: string;
  goal: string;
  assignee?: { accessCeiling?: 'full' | 'restricted' | 'ask-always' };
  input: unknown;
}) {
  return client!.call('task/create', { projectId, ...input });
}

async function waitForTask(
  taskId: string,
  predicate: (task: TaskRecord) => boolean,
): Promise<TaskRecord> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task did not reach expected state: ${taskId}`);
}
