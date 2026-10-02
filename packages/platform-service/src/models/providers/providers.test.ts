import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { RpcError, type ChatRequest, type Model } from '@gamecrafter/contracts';
import type { ProviderRuntimeAccount } from './provider';
import { AnthropicProvider } from './anthropic';
import { OpenAICompatibleProvider } from './openai-compatible';

describe('OpenAI-compatible provider', () => {
  it.each([false, true])('round-trips namespaced tool names with streaming=%s', async (stream) => {
    let wireName = '';
    let bodySeen: {
      tools: Array<{ function: { name: string } }>;
      messages: Array<{ name?: string; tool_calls?: Array<{ function: { name: string } }> }>;
    } = { tools: [], messages: [] };
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        bodySeen = JSON.parse(body);
        wireName = bodySeen.tools[0]!.function.name;
        const names = bodySeen.tools.map((tool) => tool.function.name);
        if (names.some((name: string) => !/^[a-zA-Z0-9_-]{1,64}$/.test(name))) {
          response.writeHead(400);
          response.end('Invalid function name');
          return;
        }
        if (stream) {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          response.end(
            `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call', function: { name: wireName, arguments: '{}' } }] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`,
          );
        } else {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: '',
                    tool_calls: [{ id: 'call', function: { name: wireName, arguments: '{}' } }],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
            }),
          );
        }
      });
    });
    const baseUrl = await listen(server, '/v1');
    try {
      const response = await new OpenAICompatibleProvider().complete(
        openAIAccount(baseUrl),
        model(openAIAccount(baseUrl), 'fake-model'),
        {
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'prior', name: 'fs/read-file', arguments: '{}' }],
            },
            { role: 'tool', name: 'fs/read-file', toolCallId: 'prior', content: 'file contents' },
          ],
          tools: [
            { name: 'fs/read-file', description: 'Read a file', inputSchema: { type: 'object' } },
            { name: 'fs_read-file', description: 'Distinct tool', inputSchema: { type: 'object' } },
          ],
          stream,
        },
        { signal: new AbortController().signal },
      );
      expect(response.toolCalls[0]?.name).toBe('fs/read-file');
      expect(bodySeen.messages[0]!.tool_calls?.[0]?.function.name).toBe(wireName);
      expect(bodySeen.messages[1].name).toBe(wireName);
      expect(bodySeen.tools[1].function.name).not.toBe(wireName);
    } finally {
      await closeServer(server);
    }
  });
  it('lists models and maps chat tools, usage, and authentication', async () => {
    let observedBody: Record<string, unknown> | undefined;
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        if (request.method === 'GET' && request.url === '/v1/models') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ data: [{ id: 'fake-model', display_name: 'Fake Model' }] }),
          );
          return;
        }
        expect(request.headers.authorization).toBe('Bearer sk-abcdefghijklmnopqrstuvwxyz');
        observedBody = JSON.parse(body) as Record<string, unknown>;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'hello',
                  tool_calls: [
                    {
                      id: 'call-1',
                      function: { name: 'lookup', arguments: '{"id":1}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 5 },
          }),
        );
      });
    });
    const baseUrl = await listen(server, '/v1');
    try {
      const account = openAIAccount(baseUrl);
      const provider = new OpenAICompatibleProvider();
      expect(await provider.listModels(account)).toEqual([
        { providerModelId: 'fake-model', displayName: 'Fake Model' },
      ]);
      const response = await provider.complete(
        account,
        model(account, 'fake-model'),
        chatRequest(),
        {
          signal: new AbortController().signal,
        },
      );
      expect(response).toMatchObject({
        content: 'hello',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{"id":1}' }],
        usage: { inputTokens: 12, outputTokens: 5 },
      });
      expect(observedBody?.messages).toEqual([
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hello' },
      ]);
      expect(observedBody?.tools).toMatchObject([
        { type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } },
      ]);
    } finally {
      await closeServer(server);
    }
  });

  it('streams deltas and redacts provider error bodies', async () => {
    let failRequest = false;
    const server = createServer((request, response) => {
      if (request.method === 'GET') {
        if (failRequest) {
          response.writeHead(401, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ error: { message: 'bad Bearer sk-abcdefghijklmnopqrstuvwxyz' } }),
          );
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: [] }));
        return;
      }
      request.resume();
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const delta of ['one', ' two', ' three']) {
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
      }
      response.write(
        `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 4, completion_tokens: 3 } })}\n\n`,
      );
      response.end('data: [DONE]\n\n');
    });
    const baseUrl = await listen(server, '/v1');
    try {
      const provider = new OpenAICompatibleProvider();
      const deltas: string[] = [];
      const response = await provider.complete(
        openAIAccount(baseUrl),
        model(openAIAccount(baseUrl), 'fake-model'),
        { ...chatRequest(), stream: true },
        { signal: new AbortController().signal, onDelta: (delta) => deltas.push(delta) },
      );
      expect(deltas).toEqual(['one', ' two', ' three']);
      expect(response.content).toBe('one two three');
      expect(response.usage).toMatchObject({ inputTokens: 4, outputTokens: 3 });

      failRequest = true;
      let providerError: unknown;
      try {
        await provider.listModels(openAIAccount(baseUrl));
      } catch (error) {
        providerError = error;
      }
      expect(providerError).toBeInstanceOf(RpcError);
      expect(providerError).toMatchObject({ code: -32043 });
      expect((providerError as Error).message).toContain('HTTP 401');
      expect((providerError as Error).message).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    } finally {
      await closeServer(server);
    }
  });
});

describe('Anthropic provider', () => {
  it('maps system messages, tools, responses, and streaming deltas', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let stream = false;
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        expect(request.headers['x-api-key']).toBe('anthropic-secret');
        expect(request.headers['anthropic-version']).toBe('2023-06-01');
        if (request.url === '/v1/models') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ data: [{ id: 'claude-fake', display_name: 'Claude Fake' }] }),
          );
          return;
        }
        requestBody = JSON.parse(body) as Record<string, unknown>;
        response.writeHead(200, {
          'content-type': stream ? 'text/event-stream' : 'application/json',
        });
        if (stream) {
          const events = [
            { type: 'message_start', message: { usage: { input_tokens: 7 } } },
            { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'A' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'B' } },
            {
              type: 'content_block_start',
              index: 1,
              content_block: { type: 'tool_use', id: 'stream-tool', name: 'lookup', input: {} },
            },
            {
              type: 'content_block_delta',
              index: 1,
              delta: { type: 'input_json_delta', partial_json: '{"q":"x"}' },
            },
            {
              type: 'message_delta',
              delta: { stop_reason: 'tool_use' },
              usage: { output_tokens: 2 },
            },
            { type: 'message_stop' },
          ];
          for (const event of events) {
            response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          }
          response.end();
          return;
        }
        response.end(
          JSON.stringify({
            content: [
              { type: 'text', text: 'anthropic reply' },
              { type: 'tool_use', id: 'tool-2', name: 'lookup', input: { id: 2 } },
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 9, output_tokens: 4 },
          }),
        );
      });
    });
    const baseUrl = await listen(server);
    try {
      const account = anthropicAccount(baseUrl);
      const provider = new AnthropicProvider();
      expect(await provider.listModels(account)).toEqual([
        { providerModelId: 'claude-fake', displayName: 'Claude Fake' },
      ]);
      const modelData = model(account, 'claude-fake');
      const response = await provider.complete(account, modelData, chatRequest(), {
        signal: new AbortController().signal,
      });
      expect(response).toMatchObject({
        content: 'anthropic reply',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'tool-2', name: 'lookup', arguments: '{"id":2}' }],
        usage: { inputTokens: 9, outputTokens: 4 },
      });
      expect(requestBody?.system).toBe('system prompt');
      expect(requestBody?.tools).toMatchObject([
        { name: 'lookup', input_schema: { type: 'object' } },
      ]);

      stream = true;
      const deltas: string[] = [];
      const streamResponse = await provider.complete(
        account,
        modelData,
        { ...chatRequest(), stream: true },
        { signal: new AbortController().signal, onDelta: (delta) => deltas.push(delta) },
      );
      expect(deltas).toEqual(['A', 'B']);
      expect(streamResponse.content).toBe('AB');
      expect(streamResponse.finishReason).toBe('tool_calls');
      expect(streamResponse.toolCalls).toEqual([
        { id: 'stream-tool', name: 'lookup', arguments: '{"q":"x"}' },
      ]);
      expect(streamResponse.usage).toMatchObject({ inputTokens: 7, outputTokens: 2 });
      await expect(provider.embed(account, modelData, ['text'])).rejects.toMatchObject({
        code: -32046,
      });
    } finally {
      await closeServer(server);
    }
  });
});

function openAIAccount(baseUrl: string): ProviderRuntimeAccount {
  return {
    accountId: '019535d4-2c00-7000-8000-000000000401',
    providerKind: 'openai-compatible',
    displayName: 'Fake OpenAI-compatible',
    baseUrl,
    hasCredential: true,
    headers: {},
    isLocal: true,
    privacy: 'local',
    enabled: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    apiKey: 'sk-abcdefghijklmnopqrstuvwxyz',
  };
}

function anthropicAccount(baseUrl: string): ProviderRuntimeAccount {
  return {
    accountId: '019535d4-2c00-7000-8000-000000000402',
    providerKind: 'anthropic',
    displayName: 'Fake Anthropic',
    baseUrl,
    hasCredential: true,
    headers: {},
    isLocal: true,
    privacy: 'local',
    enabled: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    apiKey: 'anthropic-secret',
  };
}

function model(account: ProviderRuntimeAccount, providerModelId: string): Model {
  return {
    modelId: `${account.accountId}/${providerModelId}`,
    accountId: account.accountId,
    providerModelId,
    displayName: providerModelId,
    capabilities: {
      chat: true,
      tools: true,
      vision: false,
      structuredOutput: true,
      streaming: true,
      embeddings: true,
      contextWindow: 32000,
      maxOutputTokens: 4096,
    },
    pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
    metadataSource: 'provider',
    metadataUpdatedAt: '2026-09-28T00:00:00.000Z',
    enabled: true,
    tags: [],
    workTypes: [],
    roles: [],
  };
}

function chatRequest(): ChatRequest {
  return {
    messages: [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'hello' },
    ],
    tools: [{ name: 'lookup', description: 'Lookup an item', inputSchema: { type: 'object' } }],
    maxTokens: 100,
  };
}

async function listen(server: ReturnType<typeof createServer>, basePath = ''): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Fake provider did not bind a TCP port');
  return `http://127.0.0.1:${address.port}${basePath}`;
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
