#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-version')) {
  process.stdout.write('3ds Max 2025.1\n');
} else {
  process.stdout.write(`DCC_ARGS:${JSON.stringify(args)}\n`);
  process.stdout.write('GCDCC_JSON:{"tool":"3dsmax","version":"2025.1","nodes":[]}\n');
}
