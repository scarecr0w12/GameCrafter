import { RpcError, RpcErrorCode, type AssetProviderKind } from '@gamecrafter/contracts';
import { MeshyProvider } from './meshy';
import { Tripo3dProvider } from './tripo3d';
import type { AssetProviderAdapter } from './provider';

export class AssetProviderRegistry {
  private readonly adapters: Map<AssetProviderKind, AssetProviderAdapter>;

  constructor(adapters: AssetProviderAdapter[] = [new MeshyProvider(), new Tripo3dProvider()]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.kind, adapter]));
  }

  list(): AssetProviderAdapter[] {
    return [...this.adapters.values()].sort((left, right) => left.kind.localeCompare(right.kind));
  }

  get(kind: AssetProviderKind): AssetProviderAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) {
      throw new RpcError(`Asset provider is not available: ${kind}`, RpcErrorCode.InvalidParams);
    }
    return adapter;
  }
}
