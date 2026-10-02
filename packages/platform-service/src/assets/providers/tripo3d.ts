import { type AssetJobRequest, type AssetProviderCapabilities } from '@gamecrafter/contracts';
import {
  assetProviderJson,
  assetProviderUrl,
  isRecord,
  numberValue,
  safeProviderText,
  type AssetProviderAdapter,
  type ProviderContext,
  type ProviderTaskOutput,
  type ProviderTaskState,
} from './provider';

const capabilities: AssetProviderCapabilities = {
  providerKind: 'tripo3d',
  jobKinds: ['text-to-3d', 'image-to-3d', 'convert'],
  outputFormats: ['glb', 'gltf', 'fbx', 'obj', 'usdz', 'stl', '3mf'],
  supportsCancel: false,
  supportsBalance: true,
};

export class Tripo3dProvider implements AssetProviderAdapter {
  readonly kind = 'tripo3d' as const;

  capabilities(): AssetProviderCapabilities {
    return capabilities;
  }

  defaultBaseUrl(): string {
    return 'https://openapi.tripo3d.ai';
  }

  termsUrl(): string {
    return 'https://developers.tripo3d.ai/en/terms';
  }

  async submit(
    context: ProviderContext,
    request: AssetJobRequest,
    imageDataUrl?: string,
  ): Promise<{ providerTaskId: string }> {
    const options = { ...(request.providerOptions ?? {}) };
    const sourceProviderTaskId = options.sourceProviderTaskId;
    delete options.sourceProviderTaskId;
    let suffix: string;
    let body: Record<string, unknown>;
    if (request.kind === 'convert') {
      if (typeof sourceProviderTaskId !== 'string' || !sourceProviderTaskId) {
        throw new Error('Convert requires the source provider task ID');
      }
      suffix = 'v3/models/convert';
      body = {
        ...options,
        input: sourceProviderTaskId,
        format: request.outputFormat === 'glb' ? 'GLTF' : request.outputFormat.toUpperCase(),
      };
    } else if (request.kind === 'image-to-3d') {
      if (!imageDataUrl) throw new Error('Image-to-3D requires image data');
      suffix = 'v3/generation/image-to-model';
      const input = await uploadImage(context, imageDataUrl);
      body = {
        ...options,
        input,
        model: typeof options.model === 'string' ? options.model : 'v3.1-20260211',
      };
    } else {
      // unverified against live API: current v3 generation routes; older integrations used the /v3/task shape.
      suffix = 'v3/generation/text-to-model';
      body = {
        ...options,
        prompt: request.prompt ?? '',
        model: typeof options.model === 'string' ? options.model : 'v3.1-20260211',
      };
      if (request.negativePrompt) {
        // unverified against live API: the v3 text generation request may not accept negative_prompt.
        body.negative_prompt = request.negativePrompt;
      }
    }
    const { data } = await assetProviderJson<unknown>(
      context,
      assetProviderUrl(context.baseUrl, suffix),
      { method: 'POST', body: JSON.stringify(body) },
    );
    const record = isRecord(data) ? data : {};
    const result = isRecord(record.data) ? record.data : record;
    const taskId = typeof result.task_id === 'string' ? result.task_id : null;
    if (!taskId) throw new Error('Tripo response did not include a task ID');
    return { providerTaskId: taskId };
  }

  async poll(context: ProviderContext, providerTaskId: string): Promise<ProviderTaskState> {
    const { data, response } = await assetProviderJson<unknown>(
      context,
      assetProviderUrl(context.baseUrl, `v3/tasks/${encodeURIComponent(providerTaskId)}`),
    );
    const record = isRecord(data) ? data : {};
    const task = isRecord(record.data) ? record.data : record;
    const status = typeof task.status === 'string' ? task.status.toLowerCase() : '';
    const normalized: ProviderTaskState['status'] =
      status === 'success' || status === 'succeeded'
        ? 'succeeded'
        : status === 'failed' || status === 'banned'
          ? 'failed'
          : status === 'cancelled' || status === 'canceled'
            ? 'cancelled'
            : status === 'expired'
              ? 'expired'
              : status === 'queued'
                ? 'queued'
                : 'running';
    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs =
      retryAfter && Number.isFinite(Number(retryAfter))
        ? Math.min(60_000, Math.max(0, Number(retryAfter) * 1000))
        : undefined;
    const errorValue = task.error_message ?? task.error ?? task.message;
    const errorText =
      typeof errorValue === 'string'
        ? errorValue
        : isRecord(errorValue) && typeof errorValue.message === 'string'
          ? errorValue.message
          : null;
    return {
      status: normalized,
      progress: Math.max(0, Math.min(100, Math.round(numberValue(task.progress)))),
      outputs: tripoOutputs(task.output),
      creditsConsumed: numericOrNull(task.credits_consumed),
      error: errorText === null ? null : safeProviderText(errorText, context.apiKey),
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    };
  }

  async balance(context: ProviderContext): Promise<number | null> {
    const { data } = await assetProviderJson<unknown>(
      context,
      assetProviderUrl(context.baseUrl, 'v3/account/balance'),
    );
    const record = isRecord(data) ? data : {};
    const result = isRecord(record.data) ? record.data : record;
    return numericOrNull(result.balance);
  }

  async test(context: ProviderContext): Promise<number | null> {
    return this.balance(context);
  }
}

function tripoOutputs(value: unknown): ProviderTaskOutput[] {
  if (!isRecord(value)) return [];
  const outputs: ProviderTaskOutput[] = [];
  const modelValues: Array<[unknown, string]> = [
    [value.pbr_model, 'glb'],
    [value.model, 'glb'],
    [value.model_url, 'glb'],
    [value.pbr_model_url, 'glb'],
  ];
  for (const [candidate, fallbackFormat] of modelValues) {
    const url =
      typeof candidate === 'string' ? candidate : isRecord(candidate) ? candidate.url : undefined;
    if (typeof url === 'string' && !outputs.some((entry) => entry.url === url)) {
      outputs.push({ url, kind: 'model', format: formatFromUrl(url, fallbackFormat) });
    }
  }
  const thumbnail = value.rendered_image ?? value.rendered_image_url;
  const thumbnailUrl =
    typeof thumbnail === 'string' ? thumbnail : isRecord(thumbnail) ? thumbnail.url : undefined;
  if (typeof thumbnailUrl === 'string') {
    outputs.push({
      url: thumbnailUrl,
      kind: 'thumbnail',
      format: formatFromUrl(thumbnailUrl, 'png'),
    });
  }
  return outputs;
}

function formatFromUrl(url: string, fallback: string): string {
  try {
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return extension && /^[a-z0-9]+$/.test(extension) ? extension : fallback;
  } catch {
    return fallback;
  }
}

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

async function uploadImage(context: ProviderContext, dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error('Tripo image upload requires a PNG or JPEG reference image');
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) {
    throw new Error('Tripo reference images must be between 1 byte and 20 MB');
  }
  const form = new FormData();
  form.append(
    'file',
    new Blob([bytes], { type: match[1] }),
    match[1] === 'image/png' ? 'reference.png' : 'reference.jpg',
  );
  const { data } = await assetProviderJson<unknown>(
    context,
    assetProviderUrl(context.baseUrl, 'v3/files'),
    {
      method: 'POST',
      body: form,
    },
  );
  const record = isRecord(data) ? data : {};
  const result = isRecord(record.data) ? record.data : record;
  if (typeof result.file_token !== 'string' || !result.file_token) {
    throw new Error('Tripo upload response did not include a file token');
  }
  return result.file_token;
}
