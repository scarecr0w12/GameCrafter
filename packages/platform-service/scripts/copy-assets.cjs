const { cpSync, existsSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const path = require('node:path');

const packageDir = path.resolve(__dirname, '..');
const source = path.join(packageDir, 'roles');
const destination = path.join(packageDir, 'lib', 'roles');
const roleDirectories = readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const roleNames = new Set(roleDirectories.map((entry) => entry.name));

mkdirSync(destination, { recursive: true });
for (const entry of readdirSync(destination, { withFileTypes: true })) {
  const target = path.join(destination, entry.name);
  if (entry.isDirectory() && existsSync(path.join(target, 'ROLE.md')) && !roleNames.has(entry.name)) {
    rmSync(target, { recursive: true, force: true });
  }
}
for (const roleDirectory of roleDirectories) {
  const target = path.join(destination, roleDirectory.name);
  rmSync(target, { recursive: true, force: true });
  cpSync(path.join(source, roleDirectory.name), target, { recursive: true });
}
