const fs = require('node:fs');
const path = require('node:path');

const addonPath = path.join(
  __dirname,
  '..',
  'dist',
  'win-unpacked',
  'resources',
  'app',
  'node_modules',
  'drivelist',
  'build',
  'Release',
  'drivelist.node',
);

if (!fs.existsSync(addonPath)) {
  throw new Error(`Windows drivelist native addon is missing: ${addonPath}`);
}

const header = Buffer.alloc(2);
const descriptor = fs.openSync(addonPath, 'r');
try {
  fs.readSync(descriptor, header, 0, header.length, 0);
} finally {
  fs.closeSync(descriptor);
}

if (header[0] !== 0x4d || header[1] !== 0x5a) {
  throw new Error(`Windows drivelist native addon is not a PE binary: ${addonPath}`);
}

process.stdout.write('Windows drivelist native addon verified.\n');
