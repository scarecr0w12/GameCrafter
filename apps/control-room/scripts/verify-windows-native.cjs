const fs = require('node:fs');
const path = require('node:path');

const unpackedDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'dist', 'win-unpacked');
const appDir = path.join(unpackedDir, 'resources', 'app');
const appPackage = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const electronMain = 'lib/backend/electron-main.js';
if (appPackage.main !== electronMain || !fs.existsSync(path.join(appDir, electronMain))) {
  throw new Error(`Windows package must launch Theia's Electron main entry: ${electronMain}`);
}

const addonPath = path.join(
  appDir,
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
