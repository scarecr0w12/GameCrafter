import type {
  AssetJobKind,
  AssetJobStatus,
  AssetOutputFormat,
  AssetProviderCapabilities,
} from '@gamecrafter/contracts';

export interface AssetJobActions {
  canCancel: boolean;
  canReview: boolean;
  canImport: boolean;
}

export function assetJobActions(status: AssetJobStatus): AssetJobActions {
  return {
    canCancel: ['queued', 'submitted', 'running'].includes(status),
    canReview: status === 'review' || status === 'rejected',
    canImport: status === 'approved',
  };
}

export function availableAssetJobKinds(
  provider: AssetProviderCapabilities | undefined,
): AssetJobKind[] {
  return provider ? [...provider.jobKinds] : [];
}

export function availableAssetOutputFormats(
  provider: AssetProviderCapabilities | undefined,
): AssetOutputFormat[] {
  return provider ? [...provider.outputFormats] : [];
}

export function nameBasedLodLevelCount(names: readonly string[]): number {
  const groups = new Map<string, Set<number>>();
  for (const name of names) {
    const match = /^(.*)_LOD(\d+)$/i.exec(name);
    if (!match) continue;
    const levels = groups.get(match[1]!.toLowerCase()) ?? new Set<number>();
    levels.add(Number(match[2]));
    groups.set(match[1]!.toLowerCase(), levels);
  }
  return Math.max(0, ...[...groups.values()].map((levels) => levels.size));
}
