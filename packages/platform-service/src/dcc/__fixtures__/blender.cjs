#!/usr/bin/env node
void (async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const args = process.argv.slice(2);
  if (args.includes('--version')) {
    process.stdout.write('Blender 5.2.2\n');
    process.exit(0);
  }
  const exprIndex = args.indexOf('--python-expr');
  const pythonIndex = args.indexOf('--python');
  const script =
    exprIndex >= 0
      ? (args[exprIndex + 1] ?? '')
      : pythonIndex >= 0 && fs.existsSync(args[pythonIndex + 1])
        ? fs.readFileSync(args[pythonIndex + 1], 'utf8')
        : '';
  const paths = new Set();
  for (const match of script.matchAll(/(?:filepath|open)\s*=?\s*\(?("(?:\\.|[^"\\])*")/g)) {
    try {
      paths.add(JSON.parse(match[1]));
    } catch {}
  }
  const report = {
    tool: 'blender',
    version: '5.2.2',
    python: '3.11.9',
    objects: [{ name: 'Cube', type: 'MESH', vertices: 8, faces: 6 }],
    meshes: 1,
    materials: 1,
    armatures: 0,
    animations: [],
    collections: ['Collection'],
    missingTextures: [],
    nonManifold: [],
  };
  for (const outputPath of paths) {
    try {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (outputPath.endsWith('.json'))
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      else if (outputPath.endsWith('.glb')) fs.writeFileSync(outputPath, makeGlb());
      else if (outputPath.endsWith('.png'))
        fs.writeFileSync(outputPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      else fs.writeFileSync(outputPath, 'fake blender artifact');
    } catch {}
  }
  process.stdout.write(`GCDCC_JSON:${JSON.stringify(report)}\n`);

  function makeGlb() {
    const document = Buffer.from(
      JSON.stringify({
        asset: { version: '2.0', generator: 'dcc fake fixture' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: 'Cube' }],
        meshes: [{ primitives: [] }],
      }),
    );
    const padding = (4 - (document.length % 4)) % 4;
    const json = Buffer.concat([document, Buffer.alloc(padding, 0x20)]);
    const header = Buffer.alloc(20);
    header.write('glTF', 0, 'ascii');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + json.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    return Buffer.concat([header, json]);
  }
})().catch((error) => {
  process.stderr.write(`${error}\n`);
  process.exitCode = 1;
});
