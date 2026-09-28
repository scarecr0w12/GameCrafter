import { describe, expect, it } from 'vitest';
import { RpcMethods } from '../rpc/protocol';
import { compile } from '../validation';
import {
  ModelCapabilitiesSchema,
  ModelSchema,
  ProviderAccountSchema,
  RouteOutcomeSchema,
} from './schema';

describe('model contracts', () => {
  it('keeps provider credentials out of public account records', () => {
    const account = {
      accountId: '019535d4-2c00-7000-8000-000000000301',
      providerKind: 'openai-compatible',
      displayName: 'Local Ollama',
      baseUrl: 'http://localhost:11434/v1',
      hasCredential: false,
      headers: {},
      isLocal: true,
      privacy: 'local',
      enabled: true,
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    };
    const validate = compile(ProviderAccountSchema);
    expect(validate.check(account)).toBe(true);
    expect(validate.check({ ...account, apiKey: 'must-not-be-returned' })).toBe(false);
  });

  it('validates capabilities, per-model eligibility, and outcome bounds', () => {
    const capabilities = {
      chat: true,
      tools: true,
      vision: false,
      structuredOutput: true,
      streaming: true,
      embeddings: false,
      contextWindow: 8192,
      maxOutputTokens: null,
    };
    expect(compile(ModelCapabilitiesSchema).check(capabilities)).toBe(true);
    expect(
      compile(ModelSchema).check({
        modelId: '019535d4-2c00-7000-8000-000000000301/qwen2.5-coder',
        accountId: '019535d4-2c00-7000-8000-000000000301',
        providerModelId: 'qwen2.5-coder',
        displayName: 'Qwen Coder',
        capabilities,
        pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
        metadataSource: 'provider',
        metadataUpdatedAt: '2026-09-28T00:00:00.000Z',
        enabled: true,
        tags: ['local'],
        workTypes: ['code'],
        roles: ['programmer'],
      }),
    ).toBe(true);
    expect(
      compile(RouteOutcomeSchema).check({
        decisionId: '019535d4-2c00-7000-8000-000000000302',
        success: true,
        qualityScore: 1.1,
        source: 'validation',
        costUsd: 0,
        latencyMs: 50,
        inputTokens: 10,
        outputTokens: 20,
      }),
    ).toBe(false);
  });

  it('requires exactly one model-completion selection mode', () => {
    const validate = compile(RpcMethods['model/complete'].params);
    const request = { messages: [] };
    expect(validate.check({ modelId: 'account/model', request })).toBe(true);
    expect(validate.check({ route: { taskType: 'code' }, request })).toBe(true);
    expect(validate.check({ modelId: 'account/model', route: { taskType: 'code' }, request })).toBe(
      false,
    );
    expect(validate.check({ request })).toBe(false);
  });
});
