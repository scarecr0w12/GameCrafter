---
name: mcp-multiversion-client
description: Implement the platform's MCP connection manager and tool broker adapter in TypeScript so it talks to MCP servers across protocol revisions 2025-03-26 through 2026-07-28 (stdio and Streamable HTTP, server/discover probe with legacy initialize fallback, deprecated Roots/Sampling/Logging handling, MRTR input_required results). Use when writing or reviewing MCP client code, connection settings, or engine/DCC MCP connector adapters.
license: MIT
compatibility: TypeScript with the official MCP TypeScript SDK; Node.js >=18.
metadata:
  author: gamedev-platform
  version: "1.0"
---

# MCP client across protocol revisions

Design contract: `docs/SKILLS_AGENTS_AND_TOOLS.md` §4.1. Research basis: `docs/research/agent-skills-and-agent-ecosystem.md` (MCP section).

## Revision landscape you must support

| Revision | Handshake | Sessions | Server→client requests | Notes |
| --- | --- | --- | --- | --- |
| 2025-03-26 | `initialize` + `notifications/initialized` | `Mcp-Session-Id` (HTTP) | `sampling/createMessage`, `roots/list` | Streamable HTTP introduced; HTTP+SSE deprecated |
| 2025-06-18 | same | same | + `elicitation/create` | Structured tool output, resource links, `MCP-Protocol-Version` header required on HTTP, `title` fields |
| 2025-11-25 | same | same | same | Tasks experimental in core; URL-mode elicitation |
| 2026-07-28 | **none** — every request carries `_meta` `io.modelcontextprotocol/protocolVersion` + `clientCapabilities`; `server/discover` RPC is mandatory | **removed** | **replaced by MRTR**: results with `resultType: "input_required"`, client retries with `inputResponses` | `ping`, `logging/setLevel`, roots-changed removed; Roots/Sampling/Logging deprecated; tasks moved to extension `io.modelcontextprotocol/tasks`; `subscriptions/listen` replaces GET stream; `ttlMs`/`cacheScope` on list results; all results carry `resultType` |

Source: [MCP changelog (latest)](https://modelcontextprotocol.io/specification/latest/changelog), [2025-06-18 changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog).

## Connection procedure

1. Build the transport from the connection record: `mode: command` → stdio child process; `mode: endpoint` → Streamable HTTP; `mode: docker` → start the owned container, then stdio or HTTP per record. Never accept HTTP+SSE except when the record is explicitly marked `legacy-sse`.
2. Probe: call `server/discover`. On success, record the advertised protocol versions and pick the highest one this client implements.
3. On JSON-RPC method-not-found (or transport error before any response on stdio), fall back to `initialize` with `protocolVersion` set to the newest pre-2026 revision (2025-11-25); accept the server's returned version if it is one you support; send `notifications/initialized`.
4. Persist `negotiatedRevision`, `serverInfo`, and `capabilities` on the connection record; show them in Settings.
5. Fetch `tools/list` (deterministic order expected; cache by `ttlMs`/`cacheScope` when present, otherwise until `toolsListChanged`). Register each tool with the broker under `<connection>/<tool>`.
6. On 2026-07-28 servers, open `subscriptions/listen` only for `toolsListChanged` (and `resourcesListChanged` if resources are used). Treat a broken stream as "re-list on next use", not as a connection failure.

## Handling server→client interactions

- **MRTR (2026-07-28):** when a tool result has `resultType: "input_required"`, turn each `inputRequests` entry into a broker question (UI prompt in Ask-always, board question for background agents). Retry the same request with `inputResponses` and the server's `requestState`. Treat results missing `resultType` (older servers) as `"complete"`.
- **Legacy elicitation/sampling/roots (≤2025-11-25):** support `elicitation/create` by the same question path. Refuse `sampling/createMessage` unless the connection setting "allow server-initiated model calls" is on; when on, route it through the platform router with the connection's model pool and account for cost against the connection. Answer `roots/list` with the Project folder only when the connection is Project-scoped.
- Never implement client behaviour that depends on the deprecated features for correctness.

## Broker metadata for each MCP tool

Attach: `execution-mode` (`project-file` | `headless-process` | `live-editor`), `side-effects` (`none` | `workspace-write` | `external-write` | `paid` | `destructive`), and `evidence`. Default `side-effects` from tool annotations (`readOnlyHint` → `none`, `destructiveHint` → `destructive`) and otherwise `external-write` until the user classifies the tool. Any tool that executes arbitrary code in a host application (Blender `execute_code`, Unreal Python remote execution, Maya `commandPort`) is `destructive` regardless of annotations.

## Testing checklist

- Contract tests against fixture servers for each revision (a small in-repo TS server per revision, plus the SDK's example server).
- A test where `server/discover` returns method-not-found and the fallback succeeds.
- A test where the server returns an unsupported protocol version → surface `UnsupportedProtocolVersionError` to the UI, do not retry silently.
- A test that `input_required` → question → retry round-trips with `requestState` preserved.
- A test that a Sampling request is refused by default and logged.

## Gotchas

- `MCP-Protocol-Version` header is required on every HTTP request after negotiation for 2025-06-18+; 2026-07-28 additionally requires `Mcp-Method` and `Mcp-Name` headers on POSTs.
- Error codes: `-32020`…`-32099` are reserved for MCP (`UnsupportedProtocolVersion` is `-32022`); resource-not-found is `-32602` since 2026-07-28.
- Tool `inputSchema`/`outputSchema` may use any JSON Schema 2020-12 keyword since 2026-07-28; validate with a 2020-12-capable validator and bound `$ref` resolution.
- Community engine/DCC servers (Unity, Unreal, Godot, Blender bridges) mostly target 2025-era revisions; test the fallback path against at least one of them before claiming support.
