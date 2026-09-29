import type { EmbeddingProfile, VectorStoreKind } from '@gamecrafter/contracts';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface VectorStoreHealth {
  kind: VectorStoreKind;
  reachable: boolean;
  collection: string | null;
  error: string | null;
  version?: string | null;
}

export interface VectorStore {
  readonly kind: VectorStoreKind;
  ensureCollection(profile: EmbeddingProfile): Promise<string | null>;
  upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void>;
  delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void>;
  search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<VectorSearchHit[]>;
  count(profile: EmbeddingProfile, filter: Record<string, unknown>): Promise<number | null>;
  health(profile?: EmbeddingProfile): Promise<VectorStoreHealth>;
}

export class NullVectorStore implements VectorStore {
  readonly kind = 'none' as const;

  async ensureCollection(profile: EmbeddingProfile): Promise<null> {
    void profile;
    return null;
  }

  async upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void> {
    void profile;
    void points;
  }

  async delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void> {
    void profile;
    void pointIds;
  }

  async search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<VectorSearchHit[]> {
    void profile;
    void vector;
    void filter;
    void limit;
    return [];
  }

  async count(profile: EmbeddingProfile, filter: Record<string, unknown>): Promise<null> {
    void profile;
    void filter;
    return null;
  }

  async health(): Promise<VectorStoreHealth> {
    return { kind: this.kind, reachable: false, collection: null, error: null, version: null };
  }
}
