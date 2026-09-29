#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version')) {
  process.stdout.write('Unity CLI 1.2.3\n');
} else {
  process.stdout.write(`${JSON.stringify(args)}\n`);
}
