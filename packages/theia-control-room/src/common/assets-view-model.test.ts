import { describe, expect, it } from 'vitest';
import type { AssetProviderCapabilities } from '@gamecrafter/contracts';
import {
  assetJobActions,
  availableAssetJobKinds,
  availableAssetOutputFormats,
  nameBasedLodLevelCount,
} from './assets-view-model';

const capabilities: AssetProviderCapabilities = {
  providerKind: 'meshy',
  jobKinds: ['text-to-3d', 'image-to-3d', 'refine'],
  outputFormats: ['glb', 'fbx'],
  supportsCancel: false,
  supportsBalance: false,
};

describe('assets view model', () => {
  it('filters job kinds and formats from provider capabilities', () => {
    expect(availableAssetJobKinds(capabilities)).toEqual(['text-to-3d', 'image-to-3d', 'refine']);
    expect(availableAssetOutputFormats(capabilities)).toEqual(['glb', 'fbx']);
    expect(availableAssetJobKinds(undefined)).toEqual([]);
  });

  it('exposes actions based on the lifecycle state', () => {
    expect(assetJobActions('running')).toEqual({
      canCancel: true,
      canReview: false,
      canImport: false,
    });
    expect(assetJobActions('review')).toEqual({
      canCancel: false,
      canReview: true,
      canImport: false,
    });
    expect(assetJobActions('approved')).toEqual({
      canCancel: false,
      canReview: false,
      canImport: true,
    });
  });

  it('counts LODs by case-insensitive base name', () => {
    expect(nameBasedLodLevelCount(['Tree_LOD0', 'Tree_LOD1', 'Tree_LOD2', 'Rock_LOD0'])).toBe(3);
    expect(nameBasedLodLevelCount(['Tree_LOD0', 'Tree_LOD1'])).toBe(2);
    expect(nameBasedLodLevelCount(['Tree', 'Rock_LOD0'])).toBe(1);
  });
});
