# Contributor extension cookbook

**Last updated:** 2026-10-02

This guide makes extension boundaries practical. [Developer guide](DEVELOPER_GUIDE.md) covers repository setup; [integration guide](INTEGRATION_GUIDE.md) covers supported adapters; [glossary](GLOSSARY.md) defines the terms. Durable records belong to the platform service. Exact input/result schemas are in the [generated reference](reference/rpc-schemas.json).

## Choose the right extension boundary

| Mechanism            | Runs/installed where                                    | Owns                                                          | Example and acceptance                                                                                                                                         |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform plugin      | Service-managed manifest and isolated worker            | Contributions, tools and settings within granted capabilities | [Sample Hello](../packages/plugins/sample-hello/); run its integration tests on a supported isolation host                                                     |
| Theia extension      | Application frontend/backend modules built into the app | Views, commands and service bridge presentation               | [Control Room extension](../packages/theia-control-room/); build both application targets and exercise UI                                                      |
| Engine/editor plugin | Unity/Unreal/Godot/DCC editor                           | Editor-side APIs/bridge implementation                        | [Engine connectors](../packages/platform-service/src/engines/); prove native identity and operation in a disposable editor Project                             |
| MCP server           | External stdio/HTTP endpoint                            | Advertised protocol tools/resources and server state          | [MCP adapter](../packages/platform-service/src/mcp/); negotiate supported revision, discover tools and invoke via broker                                       |
| Skill/role           | Platform/Project/plugin instruction roots               | Reusable guidance and runner constraints                      | [Skill loader](../packages/platform-service/src/skills/) and [role loader](../packages/platform-service/src/roles/); validate then inspect registry/activation |

These are independently installed lifecycles. A platform plugin manifest cannot install a compiled Theia module or implicitly activate an editor addon. The [current standards research](research/documentation-standards-verification.md) gives sourced external context; repository packages remain the implementation reference.

## Build and exercise the sample platform plugin

From the repository root with existing npm dependencies:

```powershell
npm run build -w @gamecrafter/plugin-sdk
npm run build -w @gamecrafter/plugin-sample-hello
npm test -w @gamecrafter/platform-service -- src/plugins
```

Read [its manifest](../packages/plugins/sample-hello/gamecrafter-plugin.json), [worker](../packages/plugins/sample-hello/src/index.ts), and [SDK](../packages/plugin-sdk/src/). In Plugins, inspect the local sample directory, review declared capabilities, install it at the intended scope and enable/start it. Inspect registered `sample-hello/greet`, invoke it with `{"name":"Lantern Workshop"}` through the supported broker/tool surface, and compare the greeting/evidence. Stop/disable and uninstall after the exercise. Retain installation/privilege/runtime errors. Installation alone does not establish a started worker.

Runtime prerequisite: inspect `plugin/isolationReport` and the host's available isolation implementation. The repository's Windows runtime has unsupported isolation paths; do not bypass them or claim that a Windows install proves tool execution. On a supported Linux host, test the actual worker boundary. Tests use their named host/fixture and explicitly skip missing prerequisites.

Manifest capabilities currently include Project reads/writes, process spawn, outbound network (optionally a host allowlist), tool calls, model completion, board reads/posts and secret reads. [Capability schema](../packages/contracts/src/plugins/schema.ts) supplies exact forms. Contributions include schemas/tools, modules/genres/record types, settings, skills/roles, commands and declarative panels. Review requested privileges separately from implementation correctness. A plugin tool invoking another tool still goes through host authorization. Do not use the sample's secret-testing branches as a production secret-output pattern.

## Create a Project skill and role

Create `.agents/skills/lantern-review/SKILL.md` under the registered Project workspace (inspect Skills & Roles and registry configuration first). Trust the intended Project before activating its local instructions:

```markdown
---
name: lantern-review
description: Review Lantern Workshop collection/reset rules against its native fixture.
metadata:
  gamecrafter-purpose: 'tutorial acceptance'
---

Read docs/DESIGN.md and game/main.gd. Identify collection and reset rules.
Run native acceptance only in a disposable copy when Godot is available.
Report the exact engine version, check results and unavailable prerequisites.
```

The folder name must match the skill name. Read the guide in the UI after registry refresh; check its hash/location and enablement. A script dependency stays an explicit prerequisite. Activation is instruction selection, not authorization. [Agent Skills specification](https://agentskills.io/specification) defines external format; the loader supplies platform-specific validation/policy.

A matching role can use existing fields:

```yaml
---
name: lantern-reviewer
description: Inspect the disposable lantern design and source.
work-types: review
max-access: restricted
tools: fs/read-file,fs/list
skills: lantern-review
isolation: none
memory: none
---
Report source findings without claiming runtime checks you did not perform.
```

Save it as `.gamecrafter/roles/lantern-reviewer/ROLE.md` under that Project workspace. Validate with the existing loader/registry; do not treat `ROLE.md` as an Agent Skills standard. Plugin roles cannot set Full access or declare inline MCP servers. For writable work, choose the required isolation/locks and actual allowlisted tools rather than copying this read-only example unchanged. Native examples are in [bundled roles](../packages/platform-service/roles/).

## Consume bounded filesystem and tool results

`fs/list` returns a page, not an exhaustive recursive tree. Its optional `limit` ranges from 1 to 200 (default 100); `offset` selects the next page. Follow the returned `nextOffset` while `truncated` is true, keeping path/recursive/includeGenerated options fixed. Recursive traversal skips generated/cache trees by default; `includeGenerated: true` includes them deliberately. Directory entries remain visible, and explicit access still goes through normal containment/policy checks. Live filesystem changes can affect offsets.

Agent context uses bounded previews for oversized tool responses and a local serialized-request size estimate. Full results remain in the durable broker call record. A preview is not the full file and the estimate is not a provider-specific tokenizer. Request narrower paths or smaller pages rather than interpreting truncated text as absent data. [Builtin tools](../packages/platform-service/src/tools/builtin-tools.ts), [agent runtime](../packages/platform-service/src/agents/agent-runtime.ts) and the [permanent bounds record](changes/2026-10-02-swarm-context-bounds.md) define the current limits and regression evidence.

## Add an MCP connection and inspect a tool

Use Connections to configure a supported transport and a server command/URL, its intended scope and credential reference. First verify that the server can start/respond in isolation. Connect, inspect negotiated revision/capabilities and discovered tool definitions, then invoke one harmless read operation through the tool broker. Keep the canonical platform tool ID from discovery; provider tool-name encoding is a separate adapter concern.

Use the existing [MCP integration tests](../packages/platform-service/src/mcp/) as runnable local fixtures:

```powershell
npm test -w @gamecrafter/platform-service -- src/mcp
```

Those tests exercise transports/adaptation/reconnection/errors with fixture servers. They are not acceptance of a third-party engine server. Recent MCP and older initialized revisions have different session behavior; inspect negotiated support instead of assuming that an SDK upgrade establishes every protocol revision. On failure preserve transport/revision/tool identity and sanitized connection logs. Retry read operations deliberately; do not replay a possibly completed mutation without idempotency evidence.

For a concrete runnable MCP server, use [lantern-mcp/server.cjs](examples/lantern-mcp/server.cjs): run `node docs/examples/lantern-mcp/server.cjs` from this installed workspace, or configure Connections with the absolute Node executable and absolute server path as its single argument. Stdout is reserved for protocol messages; the server exposes only the fixed `lantern_rule` tool. Run `node scripts/capture-documentation.cjs --scenario connections` to configure it through the actual UI, explicitly classify the discovered tool, call it through the service broker and disconnect. The [captured report](images/lantern-mcp/capture-report.json) negotiated 2025-11-25; it does not claim an external editor bridge or every newer protocol revision.

## Extend a connector without overstating readiness

Study [engine adapters](../packages/platform-service/src/engines/) or [DCC adapters](../packages/platform-service/src/dcc/) and their contracts before adding an operation. Keep file identity, headless CLI and live-editor identity separate. Validate input path containment, native Project identity, executable/version, timeout, cancellation, output collection and failure statuses. Add a disposable native fixture and a focused test for actual behavior. A live bridge must probe the intended editor/Project before mutations; generic connectivity is insufficient.

Run package tests while iterating, then the repository gate. Keep commands and outputs in service-run records; Theia should render capabilities/results through its typed bridge. Preserve identifiers and stored data. Add schemas/migrations only when required by an actual new field/behavior.

## Contracts, notifications, cancellation and errors

Add or modify TypeBox schemas in [contracts](../packages/contracts/src/) before implementation. Use `additionalProperties: false` where the established record/message contract requires it and include the specified schema version. Add the method/notification to the existing RPC table, implement service ownership, then use typed `ServiceClient.call` in consumers. Rebuild and regenerate system references; a schema change needs explicit compatibility notes, not merely a product version bump.

Notifications are prompts to refresh authoritative state. Handle reconnect/reload by fetching current records; do not keep durable task/board/router state only in a widget. Find exact notification names in the [surface inventory](reference/documentation-inventory.json), and use `client.onNotification(name, handler)` and `client.onClose(handler)` from the [client contract](../packages/service-client/src/index.ts). The connection owns subscriptions until `close()`; avoid accumulating old clients when reconnecting.

For task cancellation, pass the existing cancellation signal through worker/process/transport operations and retain terminal status/events. Verify cancellation while blocked, during execution and after completion as applicable. Preserve timeout versus user cancellation versus downstream failure in evidence. Error codes come from the shared contracts; use typed RPC errors with useful sanitized context. Do not stringify credentials/raw provider responses into public diagnostics. Tests should cover an observable failure/recovery boundary, not duplicate implementation details.

## Storage migrations and validation

The [profile recovery runner](../scripts/verify-documentation-recovery.cjs) and [runbook](RECOVERY_RUNBOOK.md) exercise current-profile archive restoration, launch at a new profile location, stable registration/override values and original credential decryption through the database seam. The [read-only diagnostic executable](examples/service-diagnostics.cjs) uses the public client path resolver and actual RPC contracts; run it with an explicit absolute profile and optional Project ID. These are concrete service-client examples, not historical migration certification.

All SQLite access goes through [database.ts](../packages/platform-service/src/db/database.ts). Inspect its current migration sequence and tests. Add a migration without rewriting prior migration history; test an older fixture upgraded to the new state and an already current profile reopened. Keep pre-upgrade backup and recovery requirements explicit. Cross-profile/Project state must stay in the owning store, not in plugin or Theia local storage.

Runnable checks:

```powershell
npm test -w @gamecrafter/contracts
npm test -w @gamecrafter/platform-service -- src/db src/profile src/tasks src/tools
npx turbo run build typecheck lint test
node scripts/generate-system-reference.cjs --check
node scripts/generate-documentation-inventory.cjs --check
```

These are repository verification commands, not claims that each external engine/provider/plugin was live-tested. Record the actual command/results and skips under [changes](changes/README.md).
