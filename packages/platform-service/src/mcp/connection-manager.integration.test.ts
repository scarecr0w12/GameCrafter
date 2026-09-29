import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;

async function startService(paths: ServicePaths): Promise<PlatformService> {
  return PlatformService.start({ paths, platformVersion: '0.1.0' });
}

async function connectService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'mcp-integration',
    clientVersion: '0.1.0',
  });
}

afterEach(async () => {
  client?.close();
  await service?.stop();
  service = undefined;
  client = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('MCP connection manager integration', () => {
  it('connects a Project-scoped command server and calls its namespaced tool through the broker', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-mcp-integration-'));
    temporaryDirectories.push(root);
    const projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);

    const project = await client.call('project/create', {
      name: 'Dungeon Delve',
      engine: { family: 'godot' },
      genres: ['rpg'],
      parentDirectory: projectsDirectory,
      folderName: 'dungeon-delve',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    const fixturePath = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
    await expect(
      client.call('mcp/add', {
        config: {
          name: 'cross-credential',
          scope: 'project',
          projectId: project.projectId,
          mode: 'command',
          command: {
            command: process.execPath,
            args: [],
            env: { API_TOKEN: '${cred:mcp:other-connection:KEY}' },
          },
          tags: [],
          enabled: false,
        },
      }),
    ).rejects.toMatchObject({ code: -32602 });
    const config = await client.call('mcp/add', {
      config: {
        name: 'dungeon-tools',
        scope: 'project',
        projectId: project.projectId,
        mode: 'command',
        command: { command: process.execPath, args: [fixturePath], env: {} },
        tags: [],
        enabled: false,
      },
    });

    const stateNotifications: Array<{ state: { connectionId: string; status: string } }> = [];
    client.onNotification('mcp/stateChanged', (event) => stateNotifications.push(event));
    const state = await client.call('mcp/connect', { connectionId: config.connectionId });
    expect(state).toMatchObject({ status: 'connected', negotiatedRevision: '2026-07-28' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      stateNotifications.some(
        (event) =>
          event.state.connectionId === config.connectionId && event.state.status === 'connected',
      ),
    ).toBe(true);
    const listedTools = await client.call('mcp/tools', { connectionId: config.connectionId });
    expect(listedTools.tools.map((tool) => tool.toolId)).toContain('dungeon-tools/echo');
    expect(listedTools.tools.find((tool) => tool.toolId.endsWith('/echo'))?.sideEffects).toBe(
      'none',
    );
    expect(listedTools.ttlMs).toBe(60_000);

    const brokerTools = await client.call('tool/list', { projectId: project.projectId });
    expect(brokerTools.tools.map((tool) => tool.toolId)).toContain('dungeon-tools/echo');
    const call = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'dungeon-tools/echo',
      input: { value: 'Dungeon Delve connected' },
      accessCeiling: 'restricted',
    });
    expect(call).toMatchObject({ status: 'completed', decision: 'allowed' });
    expect(call.output).toMatchObject({
      content: [{ type: 'text', text: 'Dungeon Delve connected' }],
    });
    expect(listedTools.tools.find((tool) => tool.toolId.endsWith('/write_file'))?.sideEffects).toBe(
      'destructive',
    );
    expect(
      listedTools.tools.find((tool) => tool.toolId.endsWith('/unannotated'))?.sideEffects,
    ).toBe('external-write');
    expect(
      listedTools.tools.find((tool) => tool.toolId.endsWith('/execute_code'))?.sideEffects,
    ).toBe('destructive');

    const classified = await client.call('mcp/classifyTool', {
      connectionId: config.connectionId,
      toolName: 'echo',
      sideEffects: 'external-write',
      executionMode: 'headless-process',
    });
    expect(classified.tool).toMatchObject({
      sideEffects: 'external-write',
      executionMode: 'headless-process',
    });
    expect(
      (await client.call('tool/list', { projectId: project.projectId })).tools.find(
        (tool) => tool.toolId === 'dungeon-tools/echo',
      )?.sideEffects,
    ).toBe('external-write');
    await expect(
      client.call('tool/call', {
        projectId: project.projectId,
        toolId: 'dungeon-tools/echo',
        input: { value: 'restricted call' },
        accessCeiling: 'restricted',
      }),
    ).rejects.toMatchObject({ code: -32031 });
    const log = await client.call('mcp/log', { connectionId: config.connectionId, limit: 20 });
    expect(log.entries.some((entry) => entry.message.includes('Connected using 2026-07-28'))).toBe(
      true,
    );

    const waitingTask = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.sleep',
      title: 'MCP input task',
      goal: 'Hold the task open while MCP asks a question',
      input: { ms: 30_000 },
    });
    await waitForTaskState(project.projectId, waitingTask.task.taskId, 'running');
    const taskToolCall = client.call('tool/call', {
      projectId: project.projectId,
      taskId: waitingTask.task.taskId,
      toolId: 'dungeon-tools/needs_input',
      input: { value: 'task-scoped input' },
      accessCeiling: 'full',
    });
    const mcpQuestion = await waitForQuestion(waitingTask.task.taskId, 'Continue?');
    await client.call('task/answer', {
      projectId: project.projectId,
      taskId: waitingTask.task.taskId,
      questionId: mcpQuestion.questionId,
      answer: 'yes',
    });
    const taskAnswerResult = await taskToolCall;
    expect(taskAnswerResult).toMatchObject({ status: 'completed', decision: 'allowed' });
    expect(taskAnswerResult.output).toMatchObject({
      content: [{ type: 'text', text: 'task-scoped input' }],
      inputResponses: { confirmation: 'yes' },
      requestState: { opaque: 'fixture-state-42' },
    });
    await client.call('task/cancel', {
      projectId: project.projectId,
      taskId: waitingTask.task.taskId,
      reason: 'MCP question integration completed',
    });

    await client.call('mcp/disconnect', { connectionId: config.connectionId });
    await client.call('mcp/remove', { connectionId: config.connectionId });
    expect((await client.call('mcp/list', { projectId: project.projectId })).connections).toEqual(
      [],
    );
  }, 60_000);

  it('auto-connects Project connections on open and enabled platform connections after service restart', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-mcp-autoconnect-'));
    temporaryDirectories.push(root);
    const projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Auto Connect Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'auto-connect-project',
    });
    await client.call('settings/set', {
      key: 'mcp.autoConnect',
      scope: 'project',
      projectId: project.projectId,
      value: false,
    });
    const fixturePath = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
    const projectConnection = await client.call('mcp/add', {
      config: {
        name: 'project-auto',
        scope: 'project',
        projectId: project.projectId,
        mode: 'command',
        command: { command: process.execPath, args: [fixturePath], env: {} },
        tags: [],
        enabled: true,
      },
    });
    expect(
      (await client.call('mcp/list', { projectId: project.projectId })).connections.find(
        (entry) => entry.config.connectionId === projectConnection.connectionId,
      )?.state.status,
    ).toBe('disconnected');
    await client.call('settings/set', {
      key: 'mcp.autoConnect',
      scope: 'project',
      projectId: project.projectId,
      value: true,
    });
    await client.call('project/open', { path: project.path });
    expect(await waitForConnection(projectConnection.connectionId, project.projectId)).toBe(
      'connected',
    );

    const platformConnection = await client.call('mcp/add', {
      config: {
        name: 'platform-auto',
        scope: 'platform',
        projectId: null,
        mode: 'command',
        command: { command: process.execPath, args: [fixturePath], env: {} },
        tags: [],
        enabled: false,
      },
    });
    await client.call('mcp/update', {
      connectionId: platformConnection.connectionId,
      patch: { enabled: true },
    });
    expect(await waitForConnection(platformConnection.connectionId)).toBe('connected');
    await client.call('mcp/disconnect', { connectionId: platformConnection.connectionId });

    client.close();
    client = undefined;
    await service.stop();
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    expect(await waitForConnection(platformConnection.connectionId)).toBe('connected');
  }, 60_000);
});

async function waitForTaskState(projectId: string, taskId: string, state: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (task.state === state) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task did not reach state ${state}: ${taskId}`);
}

async function waitForQuestion(taskId: string, prompt: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await client!.call('task/questions', { pendingOnly: true });
    const question = result.questions.find(
      (item) => item.taskId === taskId && item.prompt === prompt,
    );
    if (question) return question;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task question was not emitted: ${prompt}`);
}

async function waitForConnection(connectionId: string, projectId?: string): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await client!.call('mcp/list', { projectId });
    const state = response.connections.find(
      (entry) => entry.config.connectionId === connectionId,
    )?.state;
    if (state?.status === 'connected') return state.status;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`MCP connection did not connect: ${connectionId}`);
}
