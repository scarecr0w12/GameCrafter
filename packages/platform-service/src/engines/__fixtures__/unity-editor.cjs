#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('-version')) {
  process.stdout.write('2022.3.12f1\n');
} else {
  process.stdout.write(`${JSON.stringify(args)}\n`);
}
