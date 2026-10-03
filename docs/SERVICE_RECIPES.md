# Service recipes and system concepts

**Last updated:** 2026-10-02

These examples explain how the Control Room's behavior maps to the typed local service API. Use the [worked tutorial](WORKED_TUTORIAL.md) for UI practice, the [handbook](CONTROL_ROOM_HANDBOOK.md) for screens, and the [RPC reference](API_REFERENCE.md) plus [complete schemas](reference/rpc-schemas.json) for exact contracts. Examples below are contributor recipes, not steps ordinary users must perform to use PlayWeld.

## Connect without copying credentials into code

Run from the repository root after building the packages and starting the service for your intended profile. The typed client reads the endpoint/token through `discover`; do not print its result or paste the token into a document.

```javascript
// Save as an ignored local .turbo/inspect-service.cjs file.
const { connect, discover } = require('@gamecrafter/service-client');

async function main() {
  const endpoint = await discover(process.env);
  const client = await connect({
    ...endpoint,
    clientName: 'tutorial-inspection',
    clientVersion: '0.0.0',
  });
  try {
    const info = await client.call('service/info', {});
    const { projects } = await client.call('project/list', {});
    console.log({ serviceVersion: info.serviceVersion });
    console.table(projects.map(project => ({
      projectId: project.projectId,
      name: project.name,
      family: project.engine.family,
      path: project.path,
    })));
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
```

In PowerShell, set `GAMECRAFTER_PROFILE_DIR` before starting the service and running the script. `clientVersion` identifies this example client; it is not the service protocol version. `connect` performs the protocol/authentication handshake. A service returning metadata proves IPC responsiveness; it does not prove engine, provider, or plugin readiness.

The TypeScript `ServiceClient.call` derives request/result types from the contracts table. Runtime RPC validation also applies. Unsupported fields and invalid enum values cause invalid-parameter errors even when JavaScript lets you construct the object. Persisted records and messages use their defined schema versions; do not invent extra properties in stored state.

## Create a disposable Project through the service

The UI wizard ultimately calls the same Project service. With the connected `client` above and a fresh parent directory:

```javascript
const project = await client.call('project/create', {
  name: 'Lantern Workshop API practice',
  description: 'Disposable API learning fixture',
  engine: { family: 'godot' },
  genres: ['Adventure'],
  modules: [],
  parentDirectory: 'E:\\PlayWeldTutorial\\api-projects',
});
console.log({ projectId: project.projectId, path: project.path });
```

This writes a new workspace and registers it. It is a mutating example: use a new destination and do not rerun blindly. The returned path is authoritative; do not guess the child-folder spelling. Prefer the six-step UI tutorial for normal use. Do not clone a Project by duplicating its manifest or editing its ID manually; use the supported clone/restore workflows.

## Inspect engine layers

```javascript
const report = await client.call('engine/capabilities', {
  projectId: project.projectId,
  refresh: true,
});
console.table(Object.entries(report.layers).map(([layer, state]) => ({
  layer,
  status: state.status,
  detail: state.detail,
})));
```

For the native Godot fixture, `project.godot` declares its configuration version, application name, and engine feature version. Those allow file identity to be proven. That layer can be ready while headless execution remains unavailable because no suitable executable is registered, and live-editor remains unverified because no identity-verified bridge is bound.

Select an operation only after inspecting its capability entry. A generic availability badge does not mean every family supports every operation. When running an operation, retain its run ID, terminal status, exit code, artifact references, and sanitized logs. See [integration contracts](INTEGRATION_GUIDE.md).

## Search a document without embeddings

After copying the fixture and completing reconciliation in the UI:

```javascript
const result = await client.call('knowledge/search', {
  projectId: project.projectId,
  query: 'lantern',
  mode: 'lexical',
  sources: ['docs'],
  limit: 5,
});
for (const hit of result.hits) {
  console.log({ path: hit.path, citation: hit.citation, excerpt: hit.quote.text });
}
```

`knowledge/index/reconcile` and `knowledge/index/rebuild` return task information. Follow the resulting task and index status rather than assuming the work finished when the call returned. An index can contain document/code chunks without typed canon records. Semantic mode needs a compatible embedding profile and vector store; these are separate from ordinary chat models.

Keep citation, source revision, and line information with a retrieved conclusion. Reconcile after source edits. Retrieval results can become stale; an index result is not a replacement for the authoritative file.

## Change and remove a setting override

For the disposable Project only:

```javascript
const setting = await client.call('settings/set', {
  key: 'access.mode',
  scope: 'project',
  projectId: project.projectId,
  value: 'ask-always',
});
console.log(setting);
```

Inspect the effective/source layers and use the Settings **Reset** action when finished. Reset removes an override; writing a different value does not remove its layer. Only supported scopes are valid for a key. Never edit the SQLite database to bypass the settings service. The [settings reference](SETTINGS_REFERENCE.md) includes allowed scopes and value schemas.

## Understand task and tool evidence

Requests can become task graphs. Workers claim leases, record progress/events, checkpoint, ask questions, invoke broker tools, and finish or fail. The service retains those records. Tools declare effect/permission requirements. The broker evaluates the request and applicable policy before execution. Approvals are associated with a particular call; they are not general permission for all future tools.

Native processes and external providers can continue or fail independently. A tool call result, worker task result, integration result, and user acceptance are separate records. Preserve the IDs linking them. When validating, state exactly what was observed: “fixture response persisted,” “native editor identity matched,” “exported mesh loaded,” or “restore reopened with records intact.” Avoid expanding one result into a guarantee about unrelated capabilities.

## Extend through the correct boundary

| Extension | Contract | State ownership |
| --- | --- | --- |
| Game skill | Agent Skills `SKILL.md` plus references | Instructions; Project/platform activation lives in the service |
| Agent role | Registered role and tool/access ceilings | Service-owned runtime/tasks |
| MCP server | Negotiated MCP transport, tools/resources/input capabilities | Remote/server state plus service connection/call records |
| Platform plugin | Manifest, SDK, declared/granted capabilities, runtime | Plugin contributions; durable platform records remain in the service |
| Theia extension | Compiled frontend/backend contributions | UI and typed bridge; no independent durable task/board/router store |
| Engine/DCC connector | Installation, identity, capability/run/artifact contracts | Native files/tool state plus service run records |

Keep TypeBox schemas and RPC definitions in `packages/contracts`, service persistence in `packages/platform-service`, typed transport in `packages/service-client`, and presentation in `packages/theia-control-room`. SQLite access goes through the service's database seam. Plugins and the UI must not create a second owner for durable task/board/Project/router state.

The external IDE MCP server and native Theia AI model adapter are documented implementation gaps. Do not describe them as available integrations. The [development plan](DEVELOPMENT_PLAN.md) owns work-package status/dependency ordering; this cookbook explains the current boundaries.

## Troubleshoot at the layer that failed

| Observation | First evidence to inspect | Useful next action |
| --- | --- | --- |
| Window loads, service unavailable | Profile environment, service status, endpoint/lock ownership | Run status/foreground diagnostics for that profile |
| Invalid RPC parameters | Exact method and complete schema | Correct shape/enums; do not silently drop validation |
| Chat model absent | Account/model enabled state and chat capability | Inspect discovery and enabled metadata |
| No eligible route | Requirements, pools, model restrictions, context and budget | Resolve the actual eligibility conflict |
| Provider rejects request | Sanitized provider error and supported request features | Reproduce a small request against that endpoint |
| Editor running, layer unverified | Bound connection, identity tool output, Project/path match | Probe identity before engine mutation |
| Search misses new document | Index task, pending count, source/filter/timestamp | Reconcile and use lexical docs-only search |
| Task succeeded, files unchanged | Worktree and integration records | Review integration/conflict evidence |
| Backup configured, no recovery evidence | Run, verification, archive manifest, recovery secret | Perform an isolated restore drill |

Keep precise errors and artifacts. The [operations guide](OPERATIONS_GUIDE.md) contains recovery procedures; the [coverage record](DOCUMENTATION_COVERAGE.md) distinguishes this pass's findings from broader outstanding implementation.
