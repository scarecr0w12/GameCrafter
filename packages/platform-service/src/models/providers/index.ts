import { AnthropicProvider } from './anthropic';
import { OpenAICompatibleProvider } from './openai-compatible';
import { ModelProviderRegistry } from './provider-registry';

export * from './anthropic';
export * from './openai-compatible';
export * from './provider';
export * from './provider-registry';

export function createBuiltinModelProviders(): ModelProviderRegistry {
  const providers = new ModelProviderRegistry();
  providers.register('openai-compatible', new OpenAICompatibleProvider());
  providers.register('anthropic', new AnthropicProvider());
  return providers;
}
