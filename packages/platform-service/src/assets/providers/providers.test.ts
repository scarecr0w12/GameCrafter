import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import type { ProviderContext } from './provider';
import { MeshyProvider } from './meshy';
import { Tripo3dProvider } from './tripo3d';

describe('asset providers', () => {
  it('authenticates Meshy preview, refine, and image jobs and extracts result URLs', async () => {
    const requests: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
    const server = createServer(async (request, response) => {
      const body = await readBody(request);
      expect(request.headers.authorization).toBe('Bearer test-meshy-key');
      requests.push({ method: request.method ?? '', url: request.url ?? '', body });
      if (request.method === 'POST') {
        sendJson(response, 200, { result: { id: `task-${requests.length}` } });
        return;
      }
      sendJson(response, 200, {
        result: {
          status: 'SUCCEEDED',
          progress: 100,
          credit_usage: 12,
          model_urls: {
            glb: 'https://cdn.example.test/model.glb',
            obj: 'https://cdn.example.test/model.obj',
          },
          thumbnail_url: 'https://cdn.example.test/thumb.png',
        },
      });
    });
    const context = await start(server, 'test-meshy-key');
    const provider = new MeshyProvider();
    try {
      const text = await provider.submit(context, {
        kind: 'text-to-3d',
        prompt: 'A brass lantern',
        outputFormat: '3mf',
      });
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: '/openapi/v2/text-to-3d',
        body: { mode: 'preview', prompt: 'A brass lantern', target_formats: ['3mf'] },
      });
      const state = await provider.poll(context, text.providerTaskId);
      expect(requests[1]?.url).toBe('/openapi/v2/text-to-3d/task-1');
      expect(state).toMatchObject({
        status: 'succeeded',
        progress: 100,
        creditsConsumed: 12,
        outputs: [
          { url: 'https://cdn.example.test/model.glb', kind: 'model', format: 'glb' },
          { url: 'https://cdn.example.test/model.obj', kind: 'model', format: 'obj' },
          { url: 'https://cdn.example.test/thumb.png', kind: 'thumbnail', format: 'png' },
        ],
      });

      const refined = await provider.submit(context, {
        kind: 'refine',
        sourceJobId: '00000000-0000-7000-8000-000000000001',
        outputFormat: 'glb',
        providerOptions: { sourceProviderTaskId: 'source-preview-id' },
      });
      expect(requests[2]?.body).toMatchObject({
        mode: 'refine',
        preview_task_id: 'source-preview-id',
      });
      expect(refined.providerTaskId).toBe('text:task-3');
      const image = await provider.submit(
        context,
        { kind: 'image-to-3d', imagePath: 'game/reference.png', outputFormat: 'glb' },
        'data:image/png;base64,aW1hZ2U=',
      );
      expect(requests[3]).toMatchObject({
        url: '/openapi/v1/image-to-3d',
        body: { image_url: 'data:image/png;base64,aW1hZ2U=', target_formats: ['glb'] },
      });
      expect((await provider.poll(context, image.providerTaskId)).status).toBe('succeeded');
      expect(requests[4]?.url).toBe('/openapi/v1/image-to-3d/task-4');
    } finally {
      await close(server);
    }
  });

  it('uses Tripo v3 endpoints, maps task output, queries balance, and backs off on 429', async () => {
    const requests: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
    let balanceAttempts = 0;
    const server = createServer(async (request, response) => {
      const body = await readBody(request);
      expect(request.headers.authorization).toBe('Bearer test-tripo-key');
      requests.push({ method: request.method ?? '', url: request.url ?? '', body });
      if (request.url === '/v3/account/balance') {
        balanceAttempts += 1;
        if (balanceAttempts === 1) {
          response.writeHead(429, { 'retry-after': '0' });
          response.end(JSON.stringify({ error: 'rate limited' }));
          return;
        }
        sendJson(response, 200, { data: { balance: 42.5, frozen: 0 } });
        return;
      }
      if (request.method === 'POST') {
        sendJson(response, 200, { data: { task_id: `tripo-${requests.length}` } });
        return;
      }
      sendJson(response, 200, {
        data: {
          status: 'success',
          progress: 100,
          credits_consumed: 8,
          output: {
            model: 'https://cdn.example.test/model.glb',
            pbr_model: 'https://cdn.example.test/model-pbr.glb',
            rendered_image: 'https://cdn.example.test/preview.png',
          },
        },
      });
    });
    const context = await start(server, 'test-tripo-key');
    const provider = new Tripo3dProvider();
    try {
      const submitted = await provider.submit(context, {
        kind: 'text-to-3d',
        prompt: 'A stone arch',
        outputFormat: 'glb',
      });
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: '/v3/generation/text-to-model',
        body: { prompt: 'A stone arch', model: 'v3.1-20260211' },
      });
      const state = await provider.poll(context, submitted.providerTaskId);
      expect(requests[1]?.url).toBe(`/v3/tasks/${submitted.providerTaskId}`);
      expect(state).toMatchObject({
        status: 'succeeded',
        progress: 100,
        creditsConsumed: 8,
        outputs: [
          { url: 'https://cdn.example.test/model-pbr.glb', kind: 'model', format: 'glb' },
          { url: 'https://cdn.example.test/model.glb', kind: 'model', format: 'glb' },
          { url: 'https://cdn.example.test/preview.png', kind: 'thumbnail', format: 'png' },
        ],
      });
      expect(await provider.balance(context)).toBe(42.5);
      expect(balanceAttempts).toBe(2);
      const converted = await provider.submit(context, {
        kind: 'convert',
        sourceJobId: '00000000-0000-7000-8000-000000000002',
        outputFormat: 'fbx',
        providerOptions: { sourceProviderTaskId: submitted.providerTaskId },
      });
      expect(requests[4]).toMatchObject({
        url: '/v3/models/convert',
        body: { input: submitted.providerTaskId, format: 'FBX' },
      });
      expect(converted.providerTaskId).toBe(`tripo-${requests.length}`);
      const image = await provider.submit(
        context,
        { kind: 'image-to-3d', imagePath: 'game/reference.webp', outputFormat: 'glb' },
        'data:image/webp;base64,aW1hZ2U=',
      );
      expect(requests[5]).toMatchObject({
        url: '/v3/generation/image-to-model',
        body: { input: 'data:image/webp;base64,aW1hZ2U=' },
      });
      expect(image.providerTaskId).toBe(`tripo-${requests.length}`);
      expect(provider.capabilities().supportsBalance).toBe(true);
    } finally {
      await close(server);
    }
  });

  it('redacts API keys from provider HTTP errors', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'bad Bearer test-meshy-key' }));
    });
    const context = await start(server, 'test-meshy-key');
    try {
      await expect(new MeshyProvider().test(context)).rejects.toMatchObject({
        code: RpcErrorCode.AssetProviderRequestFailed,
        message: expect.not.stringContaining('test-meshy-key'),
      });
    } finally {
      await close(server);
    }
  });
});

async function start(
  server: ReturnType<typeof createServer>,
  apiKey: string,
): Promise<ProviderContext> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Fake asset provider failed to bind.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    apiKey,
    fetch,
    timeoutMs: 2000,
  };
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}
