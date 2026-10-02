#!/usr/bin/env node
void (async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const path = await import('node:path');
  const archive = process.argv.find((argument) => argument.startsWith('-archivedirectory='));
  if (archive) {
    const directory = archive.slice('-archivedirectory='.length);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'game.exe'), 'fixture executable');
  }
  process.stdout.write(`${JSON.stringify(process.argv.slice(2))}\n`);
})();
