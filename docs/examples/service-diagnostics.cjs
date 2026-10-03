// Read-only authenticated diagnostics: choose a profile explicitly; never print its token.
const fs = require('node:fs');
const path = require('node:path');
const { connect, resolveClientPaths } = require('@gamecrafter/service-client');

async function diagnostics(profile, projectId) {
  const paths = resolveClientPaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.resolve(profile),
  });
  const client = await connect({
    socketPath: paths.socketPath,
    token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'documentation-read-only-diagnostics',
    clientVersion: require('../../packages/service-client/package.json').version,
  });
  try {
    const info = await client.call('service/info', {});
    const projects = await client.call('project/list', {});
    const result = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      service: info,
      projects: projects.projects.map((p) => ({
        projectId: p.projectId,
        name: p.name,
        path: p.path,
      })),
    };
    if (projectId) {
      const project = await client.call('project/get', { projectId });
      const index = await client.call('knowledge/index/status', { projectId });
      result.project = {
        projectId: project.projectId,
        path: project.path,
        index: {
          chunks: index.chunks,
          records: index.records,
          pending: index.pending,
          conflicts: index.conflicts.length,
          brokenReferences: index.brokenReferences.length,
          vectorStoreKind: index.vectorStore.kind,
          vectorStoreReachable: index.vectorStore.reachable,
        },
      };
    }
    return result;
  } finally {
    client.close();
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (
    (args.length !== 2 && args.length !== 4) ||
    args[0] !== '--profile' ||
    (args.length === 4 && args[2] !== '--project')
  )
    throw new Error(
      'Usage: node docs/examples/service-diagnostics.cjs --profile ABSOLUTE_PATH [--project PROJECT_UUID]',
    );
  if (!path.isAbsolute(args[1])) throw new Error('Choose an absolute profile path explicitly');
  console.log(JSON.stringify(await diagnostics(args[1], args[3]), null, 2));
}
if (require.main === module)
  main().catch((error) => {
    console.error('Diagnostic failed:', error.code ?? error.name);
    process.exitCode = 1;
  });
module.exports = { diagnostics };
