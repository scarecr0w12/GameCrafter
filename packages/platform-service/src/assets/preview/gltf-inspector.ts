import type { AssetPreviewMetadata } from '@gamecrafter/contracts';

export interface GltfInspection {
  document: Record<string, unknown>;
  metadata: AssetPreviewMetadata;
  warnings: string[];
  supportedVersion: boolean;
}

export function parseGlbDocument(buffer: Buffer): Record<string, unknown> {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('Invalid GLB header');
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(
      version === 1
        ? 'glTF 1.0 is not supported by the viewer'
        : `Unsupported GLB version ${version}`,
    );
  }
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength > buffer.length || declaredLength < 20) throw new Error('Invalid GLB length');
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a || jsonLength > declaredLength - 20) {
    throw new Error('Invalid GLB JSON chunk');
  }
  const jsonText = buffer.toString('utf8', 20, 20 + jsonLength).replace(/[\u0000\u0020]+$/g, '');
  return parseGltfDocument(jsonText);
}

export function parseGltfDocument(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('glTF document must be a JSON object');
  return parsed;
}

export function inspectGltfDocument(document: Record<string, unknown>): GltfInspection {
  const asset = isRecord(document.asset) ? document.asset : {};
  const version = typeof asset.version === 'string' ? asset.version : undefined;
  const extensionsUsed = stringArray(document.extensionsUsed);
  const extensionsRequired = stringArray(document.extensionsRequired);
  const nodes = array(document.nodes);
  const meshes = array(document.meshes);
  const materials = array(document.materials);
  const textures = array(document.textures);
  const animations = array(document.animations);
  const warnings: string[] = [];
  const supportedExtensions = (extension: string): boolean =>
    extension.startsWith('KHR_materials_') ||
    extension === 'KHR_texture_transform' ||
    extension === 'KHR_mesh_quantization';
  for (const extension of extensionsRequired) {
    if (extension === 'KHR_draco_mesh_compression') {
      warnings.push('Draco-compressed geometry cannot be decoded by the viewer');
    } else if (!supportedExtensions(extension)) {
      warnings.push(`Required glTF extension ${extension} is not supported by the viewer`);
    }
  }
  const animationsNames = animations
    .map((animation) =>
      isRecord(animation) && typeof animation.name === 'string' ? animation.name : '',
    )
    .filter(Boolean);
  const metadata: AssetPreviewMetadata = {
    ...(version ? { gltfVersion: version } : {}),
    ...(typeof asset.generator === 'string' ? { generator: asset.generator } : {}),
    nodes: nodes.length,
    meshes: meshes.length,
    materials: materials.length,
    textures: textures.length,
    animations: animationsNames,
    extensionsUsed,
    extensionsRequired,
    lodLevels: gltfLodLevels(nodes),
  };
  return { document, metadata, warnings, supportedVersion: version === '2.0' };
}

export function hasExternalGltfResources(document: Record<string, unknown>): boolean {
  for (const collectionName of ['buffers', 'images']) {
    for (const value of array(document[collectionName])) {
      if (!isRecord(value) || typeof value.uri !== 'string') continue;
      if (!value.uri.startsWith('data:')) return true;
    }
  }
  return false;
}

function gltfLodLevels(nodes: unknown[]): number {
  let extensionLevels = 0;
  for (const node of nodes) {
    if (!isRecord(node) || !isRecord(node.extensions)) continue;
    const extension = node.extensions.MSFT_lod;
    if (isRecord(extension) && Array.isArray(extension.ids)) {
      extensionLevels = Math.max(extensionLevels, extension.ids.length + 1);
    }
  }
  if (extensionLevels > 0) return extensionLevels;

  const groups = new Map<string, Set<number>>();
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.name !== 'string') continue;
    const match = /^(.*)_LOD(\d+)$/i.exec(node.name);
    if (!match) continue;
    const base = match[1]!.toLowerCase();
    const levels = groups.get(base) ?? new Set<number>();
    levels.add(Number(match[2]));
    groups.set(base, levels);
  }
  return Math.max(0, ...[...groups.values()].map((levels) => levels.size));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
