#!/usr/bin/env node
// Synchronize first-party workspace versions before npm updates the lockfile.
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');
const root = path.resolve(__dirname, '..');
const version = process.argv[2];
if (!version || semver.valid(version) !== version)
  throw new Error('Provide an exact semantic version.');
const packages = [];
for (const directory of ['packages', 'packages/plugins', 'apps']) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.join(root, directory, entry.name, 'package.json');
    if (entry.isDirectory() && fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.name.startsWith('@gamecrafter/')) packages.push({ file, data });
    }
  }
}
const names = new Set(packages.map((p) => p.data.name));
// Validate impact and archive pending work before changing workspace versions.
require('./change-tracking.cjs').prepare(root, version, [
  ...packages.map(({ file }) => path.relative(root, file).replaceAll('\\', '/')),
  'package-lock.json',
]);
for (const { file, data } of packages) {
  data.version = version;
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const name of Object.keys(data[field] || {}))
      if (names.has(name)) data[field][name] = version;
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
console.log(
  `Set ${packages.length} workspaces to ${version}. Run npm install --package-lock-only --ignore-scripts next.`,
);
