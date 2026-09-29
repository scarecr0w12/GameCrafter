#!/usr/bin/env node
const { appendFileSync } = process.getBuiltinModule('node:fs');
const { spawn } = process.getBuiltinModule('node:child_process');

const args = process.argv.slice(2);
const [action, ...rest] = args;
if (process.env.GC_FAKE_DOCKER_LOG) {
  appendFileSync(process.env.GC_FAKE_DOCKER_LOG, `${JSON.stringify(args)}\n`);
}

const containerId = process.env.GC_FAKE_DOCKER_ID || 'fixture-container-id';
if (action === 'image' && rest[0] === 'inspect') process.exit(0);
if (action === 'pull') process.exit(0);
if (action === 'inspect') {
  process.stdout.write(`${containerId}\n`);
  process.exit(0);
}
if (action === 'stop') {
  process.stdout.write(`${rest[0] || containerId}\n`);
  process.exit(0);
}
if (action === 'run') {
  if (args.includes('-d')) {
    process.stdout.write(`${containerId}\n`);
    process.exit(0);
  }
  const image = process.env.GC_FAKE_DOCKER_IMAGE || 'fixture/mcp';
  const imageIndex = args.indexOf(image);
  if (imageIndex < 0) {
    process.stderr.write('fake docker could not locate the image argument\n');
    process.exit(125);
  }
  const command = args.slice(imageIndex + 1);
  if (command.length === 0) {
    process.stderr.write('fake docker run has no container command\n');
    process.exit(125);
  }
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', env: process.env });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 127;
  });
  child.on('close', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
  return;
}

process.stderr.write(`unsupported fake docker action: ${action}\n`);
process.exit(125);
