#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-version')) {
  process.stdout.write('ZBrush 2026.1.0\n');
} else {
  process.stdout.write(`DCC_ARGS:${JSON.stringify(args)}\n`);
  process.stdout.write('GCDCC_JSON:{"tool":"zbrush","version":"2026.1.0"}\n');
}
