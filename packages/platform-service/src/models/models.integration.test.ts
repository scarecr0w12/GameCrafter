import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RouteOutcome } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let projectId: string;
let projectsDirectory: string;
let fakeServer: ReturnType<typeof createServer> | undefined;

const fakeRequests: { path: string; model?: string; authorization?: string }[] = [];

async function createFakeServer(): Promise<string> {
  fakeRequests.length = 0;
  fakeServer = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk.toString()));
    request.on('end', () => {
      const profile = String(request.headers['x-model-profile'] ?? 'good');
      if (request.method === 'GET' && request.url === '/v1/models') {
        fakeRequests.push({
          path: request.url,
          authorization: request.headers.authorization,
        });
        const model =
          profile === 'cheap'
            ? {
                id: 'cheap-low-quality',
                display_name: 'Cheap low-quality',
                capabilities: { chat: true, tools: true, streaming: true },
                pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.1 },
              }
            : {
                id: 'good-expensive',
                display_name: 'Good expensive',
                capabilities: { chat: true, tools: true, streaming: true, structuredOutput: true },
                pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 1 },
              };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: [model] }));
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/chat/completions') {
        const input = JSON.parse(body) as { model?: string; stream?: boolean };
        fakeRequests.push({
          path: request.url,
          model: input.model,
          authorization: request.headers.authorization,
        });
        if (input.stream) {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          for (const delta of ['Hello', ' ', 'world']) {
            response.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`,
            );
          }
          response.write(
            `data: ${JSON.stringify({ choices: [{ finish_reason: 'stop', delta: {} }], usage: { prompt_tokens: 20, completion_tokens: 8 } })}\n\n`,
          );
          response.end('data: [DONE]\n\n');
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [{ message: { content: 'Hello world' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 20, completion_tokens: 8 },
          }),
        );
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'unknown fake endpoint' } }));
    });
  });
  await new Promise<void>((resolve) => fakeServer!.listen(0, '127.0.0.1', resolve));
  const address = fakeServer.address();
  if (!address || typeof address === 'string') throw new Error('Fake model provider did not bind');
  return `http://127.0.0.1:${address.port}/v1`;
}

async function startService(paths: ServicePaths): Promise<PlatformService> {
  return PlatformService.start({ paths, platformVersion: '0.1.0' });
}

async function connectService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  const { readFileSync } = await import('node:fs');
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'model-router-integration',
    clientVersion: '0.1.0',
  });
}

async function addAccount(baseUrl: string, displayName: string, profile: string) {
  const account = await client!.call('provider/addAccount', {
    providerKind: 'openai-compatible',
    displayName,
    baseUrl,
    apiKey: `fake-${profile}-api-key`,
    headers: { 'x-model-profile': profile },
    isLocal: true,
  });
  expect('apiKey' in account).toBe(false);
  expect(account.hasCredential).toBe(true);
  return account;
}

async function reportOutcome(
  modelId: string,
  taskType: string,
  success: boolean,
  qualityScore: number,
  latencyMs: number,
): Promise<void> {
  const decision = await client!.call('router/route', {
    projectId,
    agentRole: 'programmer',
    taskType,
    manualModelId: modelId,
  });
  await client!.call('router/reportOutcome', {
    decisionId: decision.decisionId,
    success,
    qualityScore,
    source: 'validation',
    costUsd: success ? 0.05 : 0.01,
    latencyMs,
    inputTokens: 2000,
    outputTokens: 1000,
  } satisfies RouteOutcome);
}

describe('model registry and adaptive routing integration', () => {
  afterEach(async () => {
    client?.close();
    await service?.stop();
    service = undefined;
    client = undefined;
    if (fakeServer) {
      await new Promise<void>((resolve) => fakeServer!.close(() => resolve()));
      fakeServer = undefined;
    }
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('discovers, routes, streams, records outcomes, applies constraints, and unlinks removed models', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-model-integration-'));
    temporaryDirectories.push(root);
    const profileDirectory = path.join(root, 'profile');
    projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDirectory }, 'linux');
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Model Router Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'model-router-project',
    });
    projectId = project.projectId;
    const baseUrl = await createFakeServer();

    const cheapAccount = await addAccount(baseUrl, 'Cheap local', 'cheap');
    const goodAccount = await addAccount(baseUrl, 'Good local', 'good');
    const cheapDiscovery = await client.call('model/discover', {
      accountId: cheapAccount.accountId,
    });
    const goodDiscovery = await client.call('model/discover', { accountId: goodAccount.accountId });
    expect(cheapDiscovery.added).toBe(1);
    expect(goodDiscovery.added).toBe(1);
    const cheapModelId = cheapDiscovery.models[0]!.modelId;
    const goodModelId = goodDiscovery.models[0]!.modelId;

    await client.call('settings/set', {
      key: 'models.exploration.rate',
      scope: 'project',
      value: 0,
      projectId,
    });
    for (let index = 0; index < 3; index += 1) {
      await reportOutcome(goodModelId, 'code', true, 0.95, 100);
      await reportOutcome(cheapModelId, 'code', false, 0.1, 500);
    }

    const agentPool = await client.call('pool/create', {
      name: 'Programmer models',
      scope: 'project',
      projectId,
      target: { kind: 'agent', id: 'programmer' },
      modelIds: [cheapModelId, goodModelId],
    });
    const taskPool = await client.call('pool/create', {
      name: 'Code models',
      scope: 'project',
      projectId,
      target: { kind: 'task-type', id: 'code' },
      modelIds: [cheapModelId, goodModelId],
    });

    const qualityDecision = await client.call('router/route', {
      projectId,
      agentRole: 'programmer',
      taskType: 'code',
      requiredCapabilities: ['chat'],
    });
    expect(qualityDecision.modelId).toBe(goodModelId);
    await client.call('settings/set', {
      key: 'models.autoRouting.quality',
      scope: 'project',
      value: 'cost-first',
      projectId,
    });
    const costDecision = await client.call('router/route', {
      projectId,
      agentRole: 'programmer',
      taskType: 'code',
      requiredCapabilities: ['chat'],
    });
    expect(costDecision.modelId).toBe(cheapModelId);
    await expect(
      client.call('router/route', {
        projectId,
        agentRole: 'programmer',
        taskType: 'code',
        requiredCapabilities: ['chat'],
        constraints: { maxCostUsd: 0.0001 },
      }),
    ).rejects.toMatchObject({ code: -32042, data: { stage: 'constraints' } });

    await client.call('pool/update', {
      poolId: agentPool.poolId,
      patch: { modelIds: [goodModelId] },
    });
    await client.call('pool/update', {
      poolId: taskPool.poolId,
      patch: { modelIds: [cheapModelId] },
    });
    await expect(
      client.call('router/route', {
        projectId,
        agentRole: 'programmer',
        taskType: 'code',
        requiredCapabilities: ['chat'],
      }),
    ).rejects.toMatchObject({ code: -32042, data: { stage: 'pools' } });
    await client.call('pool/update', {
      poolId: agentPool.poolId,
      patch: { modelIds: [cheapModelId, goodModelId] },
    });
    await client.call('pool/update', {
      poolId: taskPool.poolId,
      patch: { modelIds: [cheapModelId, goodModelId] },
    });
    await client.call('settings/set', {
      key: 'models.autoRouting.quality',
      scope: 'project',
      value: 'quality-first',
      projectId,
    });

    const deltas: string[] = [];
    const notificationOrder: string[] = [];
    client.onNotification('model/delta', (event) => {
      if (event.requestId === 'route-stream-1') {
        deltas.push(event.delta);
        notificationOrder.push('delta');
      }
    });
    const completePromise = client
      .call('model/complete', {
        projectId,
        requestId: 'route-stream-1',
        route: {
          projectId,
          agentRole: 'programmer',
          taskType: 'code',
          requiredCapabilities: ['chat'],
        },
        request: { messages: [{ role: 'user', content: 'say hello' }], stream: true },
      })
      .then((response) => {
        notificationOrder.push('response');
        return response;
      });
    const response = await completePromise;
    expect(deltas).toEqual(['Hello', ' ', 'world']);
    expect(notificationOrder).toEqual(['delta', 'delta', 'delta', 'response']);
    expect(response).toMatchObject({
      modelId: goodModelId,
      content: 'Hello world',
      decisionId: expect.any(String),
      usage: { inputTokens: 20, outputTokens: 8 },
    });
    const decisions = await client.call('router/decisions', { projectId, limit: 50 });
    const selfOutcome = decisions.decisions.find(
      ({ decision, outcome }) =>
        decision.decisionId === response.decisionId && outcome?.source === 'self',
    );
    expect(selfOutcome?.outcome).toMatchObject({
      success: true,
      qualityScore: null,
      source: 'self',
    });

    await client.call('provider/removeAccount', { accountId: cheapAccount.accountId });
    expect((await client.call('model/list', { accountId: cheapAccount.accountId })).models).toEqual(
      [],
    );
    const pools = await client.call('pool/list', { projectId });
    expect(pools.pools.every((pool) => !pool.modelIds.includes(cheapModelId))).toBe(true);
    expect(fakeRequests.some((request) => request.model === 'good-expensive')).toBe(true);
    expect(
      fakeRequests.every(
        (request) =>
          request.authorization === 'Bearer fake-good-api-key' ||
          (request.path === '/v1/models' && request.authorization === 'Bearer fake-cheap-api-key'),
      ),
    ).toBe(true);
  }, 60_000);
});
