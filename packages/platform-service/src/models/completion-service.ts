import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  type ChatResponse,
  type RpcNotificationParams,
  type RpcParams,
  type RouteOutcome,
} from '@gamecrafter/contracts';
import type { ModelRegistry } from './model-registry';
import type { ModelRouter } from './router';

export interface CompletionContext {
  sessionId?: string;
  signal?: AbortSignal;
  notify?: (name: 'model/delta', params: RpcNotificationParams<'model/delta'>) => void;
}

export class CompletionService {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly router: ModelRouter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async complete(
    params: RpcParams<'model/complete'>,
    context: CompletionContext = {},
  ): Promise<ChatResponse> {
    const route =
      'route' in params
        ? this.router.route(
            { ...params.route, projectId: params.route.projectId ?? params.projectId },
            context.sessionId,
          )
        : undefined;
    const modelId = route?.modelId ?? ('modelId' in params ? params.modelId : undefined);
    if (!modelId) throw new RpcError('A modelId or route is required', RpcErrorCode.InvalidParams);
    const model = this.registry.getModel(modelId);
    if (!model || !model.enabled)
      throw new RpcError(`Model not found: ${modelId}`, RpcErrorCode.ModelNotFound);
    const account = this.registry.getRuntimeAccount(model.accountId);
    if (!account || !account.enabled) {
      throw new RpcError(
        `Provider account not found: ${model.accountId}`,
        RpcErrorCode.AccountNotFound,
      );
    }
    const provider = this.registry.getProvider(account.providerKind);
    const requestId = params.request.stream ? (params.requestId ?? uuidv7()) : params.requestId;
    const startedAt = this.now().getTime();
    try {
      const response = await provider.complete(account, model, params.request, {
        signal: context.signal ?? new AbortController().signal,
        ...(params.request.stream && context.notify
          ? {
              onDelta: (delta: string) => {
                context.notify?.('model/delta', { requestId: requestId ?? uuidv7(), delta });
              },
            }
          : {}),
      });
      const result: ChatResponse = { ...response, decisionId: route?.decisionId ?? null };
      if (route) this.reportSelfOutcome(route.decisionId, result, true, undefined);
      return result;
    } catch (error) {
      if (route) {
        this.router.reportOutcome({
          decisionId: route.decisionId,
          success: false,
          qualityScore: null,
          source: 'self',
          costUsd: 0,
          latencyMs: Math.max(0, this.now().getTime() - startedAt),
          inputTokens: 0,
          outputTokens: 0,
          note: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  async embed(
    modelId: string,
    inputs: string[],
  ): Promise<{ vectors: number[][]; usage: ChatResponse['usage'] }> {
    const model = this.registry.getModel(modelId);
    if (!model || !model.enabled)
      throw new RpcError(`Model not found: ${modelId}`, RpcErrorCode.ModelNotFound);
    const account = this.registry.getRuntimeAccount(model.accountId);
    if (!account || !account.enabled) {
      throw new RpcError(
        `Provider account not found: ${model.accountId}`,
        RpcErrorCode.AccountNotFound,
      );
    }
    return this.registry.getProvider(account.providerKind).embed(account, model, inputs);
  }

  private reportSelfOutcome(
    decisionId: string,
    response: ChatResponse,
    success: boolean,
    note: string | undefined,
  ): void {
    const outcome: RouteOutcome = {
      decisionId,
      success,
      qualityScore: null,
      source: 'self',
      costUsd: response.usage.costUsd ?? 0,
      latencyMs: response.latencyMs,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      ...(note === undefined ? {} : { note }),
    };
    this.router.reportOutcome(outcome);
  }
}
