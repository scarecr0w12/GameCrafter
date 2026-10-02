#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = JSON.parse(
  fs.readFileSync(path.join(root, 'apps/control-room/package.json')),
).version;
const tag =
  process.argv[2] ||
  (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined);
if (tag && tag !== `v${version}`) throw new Error(`Tag ${tag} does not match v${version}.`);
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
for (const directory of ['packages', 'packages/plugins', 'apps']) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    const file = path.join(root, relative, 'package.json');
    if (!entry.isDirectory() || !fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file));
    if (!data.name.startsWith('@gamecrafter/')) continue;
    if (data.version !== version || lock.packages[relative]?.version !== version)
      throw new Error(`Workspace/lockfile version mismatch: ${relative}`);
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const [name, value] of Object.entries(data[field] || {}))
        if (name.startsWith('@gamecrafter/') && value !== version)
          throw new Error(`Dependency version mismatch: ${relative}/${name}`);
    }
  }
}
console.log(`Release version verified: ${version}${tag ? ' (' + tag + ')' : ''}`);

if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
