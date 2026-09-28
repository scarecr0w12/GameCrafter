import type {
  ChatRequest,
  ChatResponse,
  Model,
  ModelCapabilities,
  ModelPricing,
  ProviderAccount,
} from '@gamecrafter/contracts';

export interface ProviderRuntimeAccount extends ProviderAccount {
  apiKey?: string;
}

export interface DiscoveredModel {
  providerModelId: string;
  displayName?: string;
  capabilities?: Partial<ModelCapabilities>;
  pricing?: Partial<ModelPricing>;
}

export interface ProviderCompletionHooks {
  signal: AbortSignal;
  onDelta?: (delta: string) => void;
}

export interface ModelProvider {
  listModels(account: ProviderRuntimeAccount): Promise<DiscoveredModel[]>;
  complete(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse>;
  embed(
    account: ProviderRuntimeAccount,
    model: Model,
    inputs: string[],
  ): Promise<{ vectors: number[][]; usage: ChatResponse['usage'] }>;
}
