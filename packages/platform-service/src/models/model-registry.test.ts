import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModelCapabilities, ModelPricing } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { CredentialStore } from '../profile/credential-store';
import { ModelRegistry } from './model-registry';
import { ModelProviderRegistry, type ModelProvider } from './providers';

describe('ModelRegistry', () => {
  it('previews without writes and imports only selected models for the requested account', async () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-model-selection-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const providers = new ModelProviderRegistry();
      providers.register('openai-compatible', {
        async listModels() {
          return ['one', 'two', 'three'].map((providerModelId) => ({
            providerModelId,
            capabilities: { chat: true },
          }));
        },
        async complete() {
          throw new Error('Not used');
        },
        async embed() {
          throw new Error('Not used');
        },
      });
      const registry = new ModelRegistry(
        database,
        new CredentialStore(database, profileDir),
        providers,
      );
      const input = {
        providerKind: 'openai-compatible' as const,
        displayName: 'Selection',
        baseUrl: 'http://localhost:1234/v1',
        isLocal: true,
      };
      const first = registry.addAccount(input);
      const second = registry.addAccount({ ...input, displayName: 'Second' });
      const preview = await registry.discover(first.accountId, { preview: true });
      expect(preview).toMatchObject({ added: 0, updated: 0 });
      expect(preview.models.map((model) => model.providerModelId)).toEqual(['one', 'two', 'three']);
      expect(registry.listModels()).toEqual([]);
      const selected = await registry.discover(first.accountId, { providerModelIds: ['two'] });
      expect(selected).toMatchObject({ added: 1, updated: 0 });
      const model = selected.models[0]!;
      const saved = registry.updateModel(model.modelId, {
        enabled: false,
        pricing: { inputPerMTokUsd: 2, outputPerMTokUsd: 4 },
      });
      await registry.discover(first.accountId, { preview: true });
      expect(registry.getModel(model.modelId)).toEqual(saved);
      expect(registry.listModels({ accountId: second.accountId })).toEqual([]);
      expect(await registry.discover(first.accountId, { providerModelIds: [] })).toEqual({
        added: 0,
        updated: 0,
        models: [],
      });
      await expect(
        registry.discover(first.accountId, { providerModelIds: ['one', 'missing'] }),
      ).rejects.toThrow('no longer available');
      expect(registry.listModels().map((model) => model.providerModelId)).toEqual(['two']);
      expect(await registry.discover(first.accountId)).toMatchObject({ added: 2, updated: 1 });
      expect(registry.getModel(model.modelId)).toMatchObject({
        enabled: false,
        pricing: saved.pricing,
      });
    } finally {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it('keeps credentials private, discovers models, preserves manual metadata, and cascades account removal', async () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-model-registry-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const credentials = new CredentialStore(database, profileDir);
      const providers = new ModelProviderRegistry();
      let providerName = 'Provider name';
      let providerCapabilities: Partial<ModelCapabilities> = { chat: true, tools: false };
      let providerPricing: Partial<ModelPricing> = {
        inputPerMTokUsd: 0.2,
        outputPerMTokUsd: 0.4,
      };
      const provider: ModelProvider = {
        async listModels() {
          return [
            {
              providerModelId: 'test-model',
              displayName: providerName,
              capabilities: providerCapabilities,
              pricing: providerPricing,
            },
          ];
        },
        async complete() {
          throw new Error('Not used');
        },
        async embed() {
          throw new Error('Not used');
        },
      };
      providers.register('openai-compatible', provider);
      let now = new Date('2026-09-28T00:00:00.000Z');
      const registry = new ModelRegistry(database, credentials, providers, () => now);
      const account = registry.addAccount({
        providerKind: 'openai-compatible',
        displayName: 'Test account',
        baseUrl: 'http://localhost:1234/v1',
        apiKey: 'account-secret',
        headers: { 'X-Provider-Tag': 'local', Authorization: 'Bearer header-secret' },
        isLocal: true,
      });
      expect(account.hasCredential).toBe(true);
      expect(account.headers.Authorization).toBe('[REDACTED]');
      expect('apiKey' in account).toBe(false);
      expect(registry.getRuntimeAccount(account.accountId)).toMatchObject({
        apiKey: 'account-secret',
        headers: { Authorization: 'Bearer header-secret', 'X-Provider-Tag': 'local' },
      });

      const discovered = await registry.discover(account.accountId);
      expect(discovered).toMatchObject({ added: 1, updated: 0 });
      const model = discovered.models[0]!;
      expect(model).toMatchObject({
        modelId: `${account.accountId}/test-model`,
        capabilities: { chat: true, tools: false, vision: false },
        pricing: { inputPerMTokUsd: 0.2, outputPerMTokUsd: 0.4 },
        metadataSource: 'provider',
      });
      const manualCapabilities = { ...model.capabilities, tools: true };
      const manualPricing = { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.3 };
      await registry.updateModel(model.modelId, {
        capabilities: manualCapabilities,
        pricing: manualPricing,
      });
      providerName = 'Changed provider name';
      providerCapabilities = { chat: false, tools: false };
      providerPricing = { inputPerMTokUsd: 0.8, outputPerMTokUsd: 1.2 };
      now = new Date('2026-09-28T00:01:00.000Z');
      const refreshed = await registry.discover(account.accountId);
      expect(refreshed).toMatchObject({ added: 0, updated: 1 });
      expect(refreshed.models[0]).toMatchObject({
        capabilities: manualCapabilities,
        pricing: manualPricing,
        metadataSource: 'manual',
      });

      const pool = registry.createPool({
        name: 'Test pool',
        scope: 'platform',
        target: null,
        modelIds: [model.modelId],
      });
      registry.removeAccount(account.accountId);
      expect(registry.listModels()).toEqual([]);
      expect(registry.listPools()).toMatchObject([{ poolId: pool.poolId, modelIds: [] }]);
      expect(registry.listAccounts()).toEqual([]);
      expect(registry.getRuntimeAccount(account.accountId)).toBeUndefined();
    } finally {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });
});
