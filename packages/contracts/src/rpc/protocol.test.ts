import { describe, expect, it } from 'vitest';
import { uuidv7 } from '../ids';
import { RpcMethods } from './protocol';
import { compile } from '../validation';

describe('RPC contracts', () => {
  it('accepts discovery preview and explicit selection including an empty selection', () => {
    const schema = compile(RpcMethods['model/discover'].params);
    const accountId = uuidv7();
    expect(schema.check({ accountId })).toBe(true);
    expect(schema.check({ accountId, preview: true })).toBe(true);
    expect(schema.check({ accountId, providerModelIds: ['chosen-model'] })).toBe(true);
    expect(schema.check({ accountId, providerModelIds: [] })).toBe(true);
    expect(schema.check({ accountId, providerModelIds: ['duplicate', 'duplicate'] })).toBe(false);
    expect(schema.check({ accountId, providerModelIds: [''] })).toBe(false);
  });

  it('compiles every method parameter and result schema', () => {
    for (const method of Object.values(RpcMethods)) {
      expect(() => compile(method.params)).not.toThrow();
      expect(() => compile(method.result)).not.toThrow();
    }
  });

  it('accepts namespaced MCP tool names in broker calls', () => {
    const projectId = uuidv7();
    const toolId = 'dungeon-tools/needs_input';
    expect(compile(RpcMethods['tool/call'].params).check({ projectId, toolId, input: {} })).toBe(
      true,
    );
    expect(compile(RpcMethods['tool/calls'].params).check({ projectId, toolId })).toBe(true);
  });
});
