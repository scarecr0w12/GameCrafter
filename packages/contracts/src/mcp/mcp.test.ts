import { describe, expect, it } from 'vitest';
import { RpcErrorCode, RpcMethods, RpcNotifications, uuidv7 } from '../index';
import { compile, compileExternalJsonSchema, compileJsonSchema2020 } from '../validation';
import {
  MCP_SUPPORTED_REVISIONS,
  McpConnectionConfigSchema,
  McpConnectionStateSchema,
} from './schema';

const validateConfig = compile(McpConnectionConfigSchema);
const validateState = compile(McpConnectionStateSchema);

function config(mode: 'command' | 'endpoint' | 'docker', transportConfig: Record<string, unknown>) {
  return {
    connectionId: uuidv7(),
    name: 'dungeon-tools',
    scope: 'project',
    projectId: uuidv7(),
    mode,
    ...transportConfig,
    allowServerInitiatedModelCalls: false,
    enabled: true,
    timeoutsMs: { connect: 15_000, request: 60_000 },
    tags: [],
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
  };
}

describe('MCP connection contracts', () => {
  it('orders supported protocol revisions newest first', () => {
    expect(MCP_SUPPORTED_REVISIONS).toEqual([
      '2026-07-28',
      '2025-11-25',
      '2025-06-18',
      '2025-03-26',
    ]);
  });

  it('validates command, endpoint, and Docker connection configurations', () => {
    expect(
      validateConfig.check(
        config('command', {
          command: {
            command: 'node',
            args: ['server.js'],
            cwd: '/tmp',
            env: { API_KEY: '${cred:API_KEY}' },
          },
        }),
      ),
    ).toBe(true);
    expect(
      validateConfig.check(
        config('endpoint', {
          endpoint: {
            url: 'http://127.0.0.1:9000/mcp',
            transport: 'streamable-http',
            headers: { Authorization: '${cred:TOKEN}' },
          },
          tags: ['godot'],
        }),
      ),
    ).toBe(true);
    expect(
      validateConfig.check(
        config('docker', {
          docker: {
            image: 'example/mcp-server:1.0',
            command: ['node', 'server.js'],
            transport: 'stdio',
            mounts: [{ source: '/tmp/project', target: '/project', readOnly: true }],
            network: 'none',
            pullPolicy: 'if-missing',
            stopOnDisconnect: true,
            env: {},
          },
        }),
      ),
    ).toBe(true);
    expect(
      validateConfig.check(
        config('endpoint', {
          endpoint: { url: 'not a URL', transport: 'streamable-http', headers: {} },
        }),
      ),
    ).toBe(false);
  });

  it('validates disconnected and negotiated connection states', () => {
    expect(
      validateState.check({
        connectionId: uuidv7(),
        status: 'disconnected',
        negotiatedRevision: null,
        transport: null,
        serverInfo: null,
        capabilities: {},
        toolCount: 0,
        lastError: null,
        lastConnectedAt: null,
        containerId: null,
        legacy: false,
      }),
    ).toBe(true);
    expect(
      validateState.check({
        connectionId: uuidv7(),
        status: 'connected',
        negotiatedRevision: '2026-07-28',
        transport: 'streamable-http',
        serverInfo: { name: 'fixture', version: '1' },
        capabilities: { tools: { listChanged: true } },
        toolCount: 2,
        lastError: null,
        lastConnectedAt: '2026-09-28T00:00:00.000Z',
        containerId: null,
        legacy: false,
      }),
    ).toBe(true);
  });

  it('validates tool schemas as self-contained JSON Schema 2020-12 documents', () => {
    const validateToolInput = compileJsonSchema2020({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: { argument: { type: 'integer', minimum: 0 } },
      type: 'object',
      properties: { args: { type: 'array', items: { $ref: '#/$defs/argument' } } },
      required: ['args'],
      additionalProperties: false,
    });
    expect(validateToolInput.check({ args: [1, 2] })).toBe(true);
    expect(validateToolInput.check({ args: [-1] })).toBe(false);
    expect(() =>
      compileJsonSchema2020({ $ref: 'https://example.invalid/remote-schema.json' }),
    ).toThrow();
  });

  it('uses explicit legacy SDK schema semantics without resolving remote references or sharing IDs', () => {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'fixture',
      type: 'array',
      items: [{ type: 'integer' }, { type: 'string' }],
      additionalItems: false,
    };
    const validator = compileExternalJsonSchema(schema);
    expect(validator.check([1, 'value'])).toBe(true);
    expect(validator.check(['value', 1])).toBe(false);
    expect(validator.check([1, 'value', 3])).toBe(false);
    expect(
      compileExternalJsonSchema({ ...schema, items: [{ type: 'string' }] }).check(['changed']),
    ).toBe(true);
    expect(() =>
      compileExternalJsonSchema({
        $schema: schema.$schema,
        $ref: 'https://example.invalid/schema.json',
      }),
    ).toThrow();
    expect(() =>
      compileExternalJsonSchema({
        $schema: 'https://example.invalid/unknown-draft',
        type: 'string',
      }),
    ).toThrow();
  });

  it('exposes MCP connection operations, tool classification, logs, and input notifications', () => {
    expect(RpcMethods['mcp/list']).toBeDefined();
    expect(RpcMethods['mcp/add']).toBeDefined();
    expect(RpcMethods['mcp/update']).toBeDefined();
    expect(RpcMethods['mcp/connect']).toBeDefined();
    expect(RpcMethods['mcp/disconnect']).toBeDefined();
    expect(RpcMethods['mcp/tools']).toBeDefined();
    expect(RpcMethods['mcp/refreshTools']).toBeDefined();
    expect(RpcMethods['mcp/answer']).toBeDefined();
    expect(RpcMethods['mcp/classifyTool']).toBeDefined();
    expect(RpcMethods['mcp/log']).toBeDefined();
    expect(RpcNotifications['mcp/stateChanged']).toBeDefined();
    expect(RpcNotifications['mcp/inputRequired']).toBeDefined();
    expect(RpcErrorCode.McpConnectionNotFound).toBe(-32060);
    expect(RpcErrorCode.McpUnsupportedProtocolVersion).toBe(-32061);
    expect(RpcErrorCode.McpDockerUnavailable).toBe(-32065);
  });
});
