const path = require('node:path');
const { build } = require('esbuild');

build({
  entryPoints: [path.resolve(__dirname, '../src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  outfile: path.resolve(__dirname, '../dist/index.cjs'),
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
