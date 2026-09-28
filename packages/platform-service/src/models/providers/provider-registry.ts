import type { ProviderKind } from '@gamecrafter/contracts';
import type { ModelProvider } from './provider';

export class ModelProviderRegistry {
  private readonly providers = new Map<ProviderKind, ModelProvider>();

  register(kind: ProviderKind, provider: ModelProvider): void {
    if (this.providers.has(kind)) throw new Error(`Provider adapter already registered: ${kind}`);
    this.providers.set(kind, provider);
  }

  get(kind: ProviderKind): ModelProvider | undefined {
    return this.providers.get(kind);
  }
}
