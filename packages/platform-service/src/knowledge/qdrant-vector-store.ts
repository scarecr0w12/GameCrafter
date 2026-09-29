import {
  RpcError,
  RpcErrorCode,
  type EmbeddingProfile,
  type VectorStoreConfig,
} from '@gamecrafter/contracts';
import type { VectorPoint, VectorSearchHit, VectorStore, VectorStoreHealth } from './vector-store';

export interface QdrantVectorStoreOptions {
  url: string;
  collectionPrefix: string;
  timeoutMs: number;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class QdrantVectorStore implements VectorStore {
  readonly kind = 'qdrant' as const;
  private readonly fetcher: typeof fetch;
  private readonly ensured = new Set<string>();
  private readonly baseUrl: string;

  constructor(private readonly options: QdrantVectorStoreOptions) {
    this.baseUrl = options.url.replace(/\/+$/, '');
    this.fetcher = options.fetcher ?? fetch;
  }

  static fromConfig(config: VectorStoreConfig, apiKey?: string): QdrantVectorStore {
    if (!config.url)
      throw new RpcError('Qdrant URL is not configured.', RpcErrorCode.VectorStoreUnavailable);
    return new QdrantVectorStore({
      url: config.url,
      collectionPrefix: config.collectionPrefix ?? 'gamecrafter',
      timeoutMs: config.timeoutMs ?? 5000,
      ...(apiKey ? { apiKey } : {}),
    });
  }

  collectionName(profile: EmbeddingProfile): string {
    const prefix = this.options.collectionPrefix.replace(/[^A-Za-z0-9_-]/g, '_');
    const projectId = profile.projectId.replace(/-/g, '_');
    return `${prefix}_${projectId}_v${profile.version}`;
  }

  async ensureCollection(profile: EmbeddingProfile): Promise<string> {
    const collection = this.collectionName(profile);
    if (this.ensured.has(collection)) return collection;
    const collectionPath = `/collections/${encodeURIComponent(collection)}`;
    const existing = await this.request('GET', collectionPath, undefined, true);
    if (existing.status === 404) {
      const response = await this.request(
        'PUT',
        collectionPath,
        {
          vectors: { size: profile.dimensions, distance: 'Cosine' },
        },
        true,
      );
      if (!response.ok && response.status !== 409) await this.assertResponse(response);
    } else if (!existing.ok) {
      await this.assertResponse(existing);
    }
    this.ensured.add(collection);
    return collection;
  }

  async upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;
    const collection = await this.ensureCollection(profile);
    const normalized = points.map((point) => {
      const payloadProjectId = point.payload.projectId;
      if (payloadProjectId !== undefined && payloadProjectId !== profile.projectId) {
        throw new RpcError(
          'A vector point cannot be written for a different Project.',
          RpcErrorCode.VectorStoreUnavailable,
        );
      }
      return {
        ...point,
        payload: { ...point.payload, projectId: profile.projectId },
      };
    });
    const response = await this.request(
      'PUT',
      `/collections/${encodeURIComponent(collection)}/points?wait=true`,
      { points: normalized },
    );
    await this.assertResponse(response);
  }

  async delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void> {
    if (pointIds.length === 0) return;
    const collection = await this.ensureCollection(profile);
    const response = await this.request(
      'POST',
      `/collections/${encodeURIComponent(collection)}/points/delete?wait=true`,
      {
        filter: {
          must: [{ key: 'projectId', match: { value: profile.projectId } }, { has_id: pointIds }],
        },
      },
    );
    await this.assertResponse(response);
  }

  async search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<VectorSearchHit[]> {
    const collection = await this.ensureCollection(profile);
    if (vector.length !== profile.dimensions) {
      throw new RpcError(
        `Embedding dimensions mismatch: expected ${profile.dimensions}, received ${vector.length}.`,
        RpcErrorCode.VectorStoreUnavailable,
      );
    }
    const response = await this.request(
      'POST',
      `/collections/${encodeURIComponent(collection)}/points/search`,
      {
        vector,
        limit: Math.max(1, Math.min(Math.floor(limit), 1000)),
        with_payload: true,
        filter: this.projectFilter(profile.projectId, filter),
      },
    );
    const result = await this.jsonResult(response);
    const hits = Array.isArray(result)
      ? result
      : isRecord(result) && Array.isArray(result.points)
        ? result.points
        : [];
    return hits.flatMap((value) => {
      if (!isRecord(value) || typeof value.id !== 'string' || typeof value.score !== 'number')
        return [];
      return [
        { id: value.id, score: value.score, payload: isRecord(value.payload) ? value.payload : {} },
      ];
    });
  }

  async count(profile: EmbeddingProfile, filter: Record<string, unknown>): Promise<number> {
    const collection = await this.ensureCollection(profile);
    const response = await this.request(
      'POST',
      `/collections/${encodeURIComponent(collection)}/points/count`,
      { filter: this.projectFilter(profile.projectId, filter), exact: true },
    );
    const result = await this.jsonResult(response);
    if (!isRecord(result) || typeof result.count !== 'number') {
      throw new RpcError(
        'Qdrant returned an invalid count response.',
        RpcErrorCode.VectorStoreUnavailable,
      );
    }
    return result.count;
  }

  async health(profile?: EmbeddingProfile): Promise<VectorStoreHealth> {
    try {
      const response = await this.request('GET', '/');
      const body = await this.jsonResponse(response);
      return {
        kind: this.kind,
        reachable: true,
        collection: profile ? this.collectionName(profile) : null,
        error: null,
        version: isRecord(body) && typeof body.version === 'string' ? body.version : null,
      };
    } catch (error) {
      return {
        kind: this.kind,
        reachable: false,
        collection: profile ? this.collectionName(profile) : null,
        error: error instanceof Error ? error.message : String(error),
        version: null,
      };
    }
  }

  private projectFilter(
    projectId: string,
    filter: Record<string, unknown>,
  ): Record<string, unknown> {
    const must = Array.isArray(filter.must)
      ? filter.must.filter((condition) => !isProjectCondition(condition))
      : [];
    return {
      ...filter,
      must: [{ key: 'projectId', match: { value: projectId } }, ...must],
    };
  }

  private async request(
    method: string,
    pathname: string,
    body?: unknown,
    allowNotFound = false,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.options.apiKey) headers['api-key'] = this.options.apiKey;
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${pathname}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new RpcError(
        `Qdrant request failed: ${error instanceof Error ? error.message : String(error)}`,
        RpcErrorCode.VectorStoreUnavailable,
      );
    }
    if (!response.ok && !(allowNotFound && response.status === 404)) {
      await this.assertResponse(response);
    }
    return response;
  }

  private async assertResponse(response: Response): Promise<void> {
    if (response.ok) return;
    const detail = await response.text().catch(() => '');
    throw new RpcError(
      `Qdrant returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ''}`,
      RpcErrorCode.VectorStoreUnavailable,
      { httpStatus: response.status },
    );
  }

  private async jsonResult(response: Response): Promise<unknown> {
    const body = await this.jsonResponse(response);
    if (!isRecord(body) || !('result' in body)) {
      throw new RpcError(
        'Qdrant returned an invalid response.',
        RpcErrorCode.VectorStoreUnavailable,
      );
    }
    return body.result;
  }

  private async jsonResponse(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new RpcError('Qdrant returned invalid JSON.', RpcErrorCode.VectorStoreUnavailable);
    }
  }
}

function isProjectCondition(value: unknown): boolean {
  return isRecord(value) && value.key === 'projectId';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
