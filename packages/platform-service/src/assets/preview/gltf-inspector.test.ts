import { describe, expect, it } from 'vitest';
import {
  hasExternalGltfResources,
  inspectGltfDocument,
  parseGlbDocument,
  parseGltfDocument,
} from './gltf-inspector';

function makeGlb(document: Record<string, unknown>): Buffer {
  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const chunk = Buffer.alloc(jsonLength, 0x20);
  json.copy(chunk);
  const buffer = Buffer.alloc(20 + jsonLength);
  buffer.write('glTF', 0, 'ascii');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(jsonLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(buffer, 20);
  return buffer;
}

describe('glTF inspector', () => {
  it('reads GLB metadata and derives name-based LOD groups', () => {
    const document = {
      asset: { version: '2.0', generator: 'test' },
      nodes: [{ name: 'Lantern_LOD0' }, { name: 'Lantern_LOD1' }],
      meshes: [{}],
      materials: [{}],
      textures: [{}],
      animations: [{ name: 'Open' }],
      extensionsUsed: ['KHR_materials_ior'],
      extensionsRequired: [],
    };
    const inspected = inspectGltfDocument(parseGlbDocument(makeGlb(document)));
    expect(inspected.supportedVersion).toBe(true);
    expect(inspected.metadata).toMatchObject({
      gltfVersion: '2.0',
      generator: 'test',
      nodes: 2,
      meshes: 1,
      materials: 1,
      textures: 1,
      animations: ['Open'],
      extensionsUsed: ['KHR_materials_ior'],
      lodLevels: 2,
    });
    expect(inspected.warnings).toEqual([]);
  });

  it('derives MSFT_lod levels and warns for required Draco compression', () => {
    const inspected = inspectGltfDocument({
      asset: { version: '2.0' },
      nodes: [{ extensions: { MSFT_lod: { ids: [4, 5] } } }],
      extensionsRequired: ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'],
    });
    expect(inspected.metadata.lodLevels).toBe(3);
    expect(inspected.warnings).toEqual([
      'Draco-compressed geometry cannot be decoded by the viewer',
      'Required glTF extension EXT_meshopt_compression is not supported by the viewer',
    ]);
  });

  it('rejects GLB 1.0 and flags external glTF resources', () => {
    const oldGlb = makeGlb({ asset: { version: '1.0' } });
    oldGlb.writeUInt32LE(1, 4);
    expect(() => parseGlbDocument(oldGlb)).toThrow('glTF 1.0 is not supported by the viewer');
    const document = parseGltfDocument(
      JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }], images: [] }),
    );
    expect(hasExternalGltfResources(document)).toBe(true);
    expect(
      hasExternalGltfResources({
        asset: { version: '2.0' },
        buffers: [{ uri: 'data:application/octet-stream;base64,AA==' }],
      }),
    ).toBe(false);
  });
});
