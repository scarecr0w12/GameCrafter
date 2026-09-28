import type { ModelPricing, RouteDecision } from '@gamecrafter/contracts';

export function formatPricing(pricing: ModelPricing): string {
  const format = (value: number | null) => (value === null ? '—' : `$${value.toFixed(2)}`);
  return `${format(pricing.inputPerMTokUsd)} in / ${format(pricing.outputPerMTokUsd)} out per MTok`;
}

export function summarizeDecision(decision: RouteDecision): string {
  const candidateCount = decision.candidates.length;
  const candidates = `${candidateCount} ${candidateCount === 1 ? 'candidate' : 'candidates'}`;
  return `${decision.reason} · ${candidates}${decision.explored ? ' · explored' : ''}`;
}
