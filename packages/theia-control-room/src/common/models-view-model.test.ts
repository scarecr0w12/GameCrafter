import { describe, expect, it } from 'vitest';
import type { ModelPricing, RouteDecision } from '@gamecrafter/contracts';
import { formatPricing, summarizeDecision } from './models-view-model';

describe('models view model helpers', () => {
  it('formats known and unknown token pricing', () => {
    const pricing: ModelPricing = { inputPerMTokUsd: 0.25, outputPerMTokUsd: null };
    expect(formatPricing(pricing)).toBe('$0.25 in / — out per MTok');
  });

  it('summarizes route decisions with exploration metadata', () => {
    const decision: RouteDecision = {
      decisionId: '019535d4-2c00-7000-8000-000000000501',
      modelId: 'account/model-a',
      reason: 'quality-first selected model-a',
      explored: true,
      policyVersion: 'quality-first-v1',
      candidates: [
        {
          modelId: 'account/model-a',
          score: 0.8,
          qualityEstimate: 0.7,
          observations: 2,
          estimatedCostUsd: 0.02,
          estimatedLatencyMs: 100,
          reliability: 0.75,
        },
      ],
      context: { projectId: null, agentRole: 'coder', taskType: 'code', engine: null },
      decidedAt: '2026-09-28T00:00:00.000Z',
    };
    expect(summarizeDecision(decision)).toBe(
      'quality-first selected model-a · 1 candidate · explored',
    );
  });
});
