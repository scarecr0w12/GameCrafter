#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-version')) {
  process.stdout.write('Cinema 4D 2026.1\n');
} else {
  process.stdout.write(`DCC_ARGS:${JSON.stringify(args)}\n`);
  process.stdout.write('GCDCC_JSON:{"tool":"cinema4d","version":"2026.1","objects":[]}\n');
}
