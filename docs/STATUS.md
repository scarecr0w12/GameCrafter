# GameCrafter Implementation Status and Remaining Work

**Status:** Living status record. This document summarizes what exists in this repository today, how far each part has been verified, and what remains. It does not order the remaining work: dependency ordering lives only in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), and the complete target system is described in [PLATFORM_DESIGN.md](PLATFORM_DESIGN.md).  
**Last updated:** 2026-09-30
**Related records:** [development plan](DEVELOPMENT_PLAN.md) (authoritative per-package status text), [decision register](OPEN_DECISIONS.md), [technical architecture](TECHNICAL_ARCHITECTURE.md), [skills, roles, and tools](SKILLS_AGENTS_AND_TOOLS.md).

Evidence levels used below follow the plan's rule: **Implemented** means behaviour is covered by tests in this repository; **Verified (live)** means tested against the real engine, tool, server, or provider. "Fake-tested" means tested only against in-repo fixture servers or fake executables. Nothing here is described as secure or production-ready unless a test in this repository demonstrates it.

## 1. Snapshot

- WP0–WP18 are **Implemented (unit/integration-tested)**; WP19 is **In progress**.
- The latest full gate (`npx turbo run build typecheck lint test --concurrency=1` plus the Prettier check) passed on the current WP19 working tree: 29/29 Turbo tasks; 85 platform-service files / 298 tests, 19 contracts files / 64 tests, and 8 Control Room extension files / 16 tests; the service client, plugin SDK, and sample plugin also passed. Browser and Electron app builds completed; Electron typecheck/lint/test are configured as skipped in Turbo. Linux AppImage and DEB artifacts also built locally. The hosted release workflow and Windows target have not run.
- **No component has reached Verified (live)** except the Godot headless layer (real Godot 4.7.2 binary), the Blender headless layer (real Blender 5.2.2 LTS via WSL interop), and the Qdrant adapter (Docker-run Qdrant when `docker` is available). Everything that talks to a model provider, generation provider, Unity, Unreal, a live editor bridge, or a community MCP server is fake-tested only.
- Windows has never been exercised: named-pipe transport and AppContainer isolation remain stubbed; the NSIS installer is configured but not built or tested.
- The CI and desktop release workflows (`.github/workflows/ci.yml`, `.github/workflows/release.yml`) have not run on hosted runners.

## 2. Work package status

| WP   | Area                                   | Status      | Evidence level                                                                     | Main gaps (details in the plan)                                                                                                  |
| ---- | -------------------------------------- | ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| WP0  | Repository foundation                  | Implemented | Local turbo gate                                                                   | CI not yet run on a hosted runner                                                                                                |
| WP1  | Shared contracts                       | Implemented | Unit                                                                               | Schemas grow per package; none missing for implemented packages                                                                  |
| WP2  | Platform service core                  | Implemented | Integration                                                                        | Windows named pipe unit-tested only                                                                                              |
| WP3  | Project workspace                      | Implemented | Integration                                                                        | —                                                                                                                                |
| WP4  | Control Room shell                     | Implemented | Browser E2E by hand, Electron launch smoke                                         | No automated UI test                                                                                                             |
| WP5  | Settings system                        | Implemented | Integration                                                                        | Plugin-contributed definitions, redacted export, clone/backup copy rules                                                         |
| WP6  | Task/event graph and scheduler         | Implemented | Integration (forked workers)                                                       | Only `noop.*` and package-local handlers; no task UI (U04)                                                                       |
| WP7  | Tool broker, access modes, audit       | Implemented | Integration                                                                        | Prompt grouping, dedicated audit view (U04), retention/export settings                                                           |
| WP8  | Model providers and router             | Implemented | Fake HTTP providers                                                                | No live provider; manager model for classification, benchmark ingestion, Theia AI `LanguageModel` bridge                         |
| WP9  | Skills and roles registry              | Implemented | Integration                                                                        | Dynamic per-task activation enum and compaction protection await the agent runtime                                               |
| WP10 | MCP connection manager                 | Implemented | In-repo fixture servers (3 protocol revisions)                                     | No live community engine/DCC server; Docker HTTP port mapping untested                                                           |
| WP11 | Discussion board and maintenance agent | Implemented | Integration, fake model                                                            | Whole-file proposal diffs; canon reconciliation beyond decision records; role allowlists enforced per tool, not centrally        |
| WP12 | Plugin host and isolation              | Implemented | Linux `bwrap` adversarial tests                                                    | Signature verification (S06), egress filtering, Landlock/seccomp, Windows AppContainer (fails closed)                            |
| WP13 | Engine connectors                      | Implemented | Godot live (headless); Unity/Unreal fake executables                               | No live editor bridge tested; C04 matrix unverified                                                                              |
| WP14 | Knowledge layer                        | Implemented | Integration; Qdrant via Docker; fake embeddings                                    | No live embedding provider; only Qdrant as vector store                                                                          |
| WP15 | Asset pipeline and inspection          | Implemented | Fake Meshy/Tripo3D servers; browser smoke of viewer                                | No live provider; adapter fields marked `unverified against live API`; no DCC-format conversion; no automated UI test            |
| WP16 | DCC connectors                         | Implemented | Blender live (headless, via WSL interop); Maya/3ds Max/C4D/ZBrush fake executables | No live DCC bridge; four tools unverified against real apps; C05 stays Verify                                                    |
| WP17 | Backup and restore                     | Implemented | Local destination real; S3/FTP/Drive fake servers                                  | No live remote destination; no in-place restore; no plugin destinations; no Windows drill                                        |
| WP18 | Change graph and swarm coordinator     | Implemented | Scripted fake-model integration; real Git worktrees; browser smoke of Swarm view   | No live model provider, engine/DCC session, or Windows validation                                                                |
| WP19 | Packaging and release                  | In progress | Update manager/RPC unit and integration tests; local Linux AppImage/DEB builds     | Installation remains manual; no previous-installer capture for rollback; signing-key provisioning and Windows release validation |

## 3. What exists today, by architectural area

- **Contracts (`@gamecrafter/contracts`):** TypeBox schemas and derived types for Projects, settings, tasks/events, tools and approvals, models/providers/router, skills, MCP, board, plugins, engines, knowledge, and assets; a typed RPC method table with notifications; shared error codes; ID and redaction helpers. Every record carries `schemaVersion`.
- **Platform service (`@gamecrafter/platform-service`):** authenticated JSON-RPC over Unix socket/named pipe; global profile SQLite plus per-Project SQLite with migrations; Project create/open/clone; layered settings; supervised worker processes with leases, checkpoints, questions, and restart reconciliation; tool registry and broker with Full/Restricted/Ask-always ceilings and audit; encrypted credential store; OpenAI-compatible and Anthropic adapters with routing and outcome learning; Agent Skills loader, installer, catalog, and eleven builtin roles; multi-revision MCP client (stdio, Streamable HTTP, legacy SSE, Docker mode); discussion board with decision-to-record sync and maintenance tasks; typed change graph and confidence-weighted impact analysis, resource locks, role-aware agent runtime, Git worktrees, integration/reconciliation, and feedback propagation; plugin host with `bwrap` isolation and a TypeScript SDK; Godot/Unity/Unreal connectors; canon records, FTS5 + Qdrant retrieval with citations; asset provider accounts, generation job lifecycle, provenance import, and preview derivatives.
- **Control Room (`@gamecrafter/theia-control-room`, `apps/control-room`, `apps/control-room-browser`):** Theia Electron application and a development browser target with views for Project Home, Settings, Models & Routing, Skills & Roles, Connections, Updates, Discussion Board, Swarm (requests, task tree, locks, integrations, feedback), Plugins, Engine, Knowledge, and Assets (Three.js 3D viewer and 2D viewer), plus tool-approval and task-question prompts.
- **Plugins and SDK:** `@gamecrafter/plugin-sdk`, the `sample-hello` plugin, and a Python fixture worker exercising the language-neutral worker protocol.
- **Documentation and agent tooling:** design documents, decision register, development plan, five sourced research notes, four first-party project skills, three Devin subagent profiles.

## 4. Remaining work

Grouped by area, not ordered. Each item names the work package or register entry that owns it.

### 4.1 In-progress work packages

- **Packaging and release (WP19, P03, P04, Q03):** add a supported installer handoff and previous-installer capture for rollback, provision the Ed25519 public key to installations, and run the hosted Windows/Linux release matrix and install/rollback drills. The working tree contains Electron Builder targets, a tagged draft-release workflow, an update RPC/UI, and tested download verification; no hosted release has run.

### 4.2 Live verification debt

Everything below is Implemented against fakes and needs a run against the real system before it may be called Verified.

- Model providers: at least one live OpenAI-compatible endpoint and one Anthropic endpoint, including streaming and embeddings (WP8, WP14).
- Generation providers: Meshy and Tripo3D end to end, including the fields marked `unverified against live API` (Tripo v3 route shapes, data-URI image input, `negative_prompt`), and a refresh of the Tripo3D section of [research/dcc-and-asset-tools.md](research/dcc-and-asset-tools.md) (WP15, C06).
- Engines: Unity and Unreal headless layers against real installations; at least one live editor bridge per engine; the C04 capability matrix (WP13).
- DCC tools: Maya, 3ds Max, Cinema 4D, and ZBrush headless adapters against real installations, and at least one live DCC MCP bridge (WP16, C05).
- MCP: at least one community engine or DCC MCP server per supported protocol revision; Docker HTTP port mapping (WP10).
- Windows: named-pipe transport, AppContainer isolation, engine detection, installers (WP2, WP12, WP13, WP19, S02).
- CI: a green run of `.github/workflows/ci.yml` on a hosted runner (WP0).
- Backup destinations: S3, FTP, and Google Drive against real services; a restore drill on Windows (WP17, B06).

### 4.3 Security and isolation

- Plugin signature verification and a trust policy for unsigned plugins (S06).
- Host-level egress filtering so plugins may request a `hosts` allowlist instead of failing closed (WP12).
- Landlock and seccomp layering on Linux; the Windows AppContainer launcher (S02 stays Verify until adversarial escape tests pass on both OS targets).
- Audit retention, export, and deletion settings (S09); redacted settings export (WP5).
- Theia editor-extension privilege policy (S03).

### 4.4 Control Room surfaces

- Automated UI tests for the browser target (WP4, Q01); the Electron build is currently skipped in the Turbo gate.
- The Swarm view exposes task state/tree, progress, spent cost/tokens, questions, locks, and integrations; a dedicated audit view and approval prompt grouping remain open (U04, WP7).
- Main navigation and layout decisions (U01), Project creation and clone flow details (U02), texture-channel inspection in the asset viewer (U05).
- Accessibility and localization baseline (Q05).

### 4.5 Knowledge, canon, and modules

- Canon authority rules for drafts, proposals, and retcons (K04); optional story and disabled-module records (K07); genre taxonomy for hybrid genres (K01/K02 with K03).
- Vector stores other than Qdrant through plugins (R03); board proposal diffs finer than whole-file replacement and canon reconciliation beyond decision records (WP11).
- Engine identity versus engine version policy (W02); Git policy for code, design, and large assets (W04); SQLite corruption handling (W05).

### 4.6 Models, routing, and spend

- Manager model for task classification and online benchmark ingestion; Theia AI `LanguageModel` bridge (WP8).
- Cross-Project learning and privacy controls (M08); spending and failure behaviour per job, Project, and period (M09).
- External action recovery: idempotency and rollback for imports and paid operations (C08).

### 4.7 Product decisions still owned by the user

Open register entries classed as Product: P05 (existing game onboarding), K04, A07, M08, S03, B05 (restore semantics), U01, U02, U04. The engineering entries listed in the sections above are resolved under delegated judgment as their work packages land.

### 4.8 Documentation, quality, and contributor experience

- Test and evidence matrix (Q01), performance and resource limits (Q02), plugin SDK and contributor documentation (Q04), contribution rules and third-party notice policy accompanying Apache-2.0 (P02 remainder).
- Research notes older than a few months must be re-verified before their facts are promoted; the DCC/asset note already needs a Tripo3D refresh.
- Known test-suite behaviour: an uncached, fully parallel Turbo run has intermittently hit timing assertions in worker-startup and MCP request-count tests; they pass serially and in isolation. Tightening those assertions belongs with Q01.

## 5. Maintaining this document

Update this file in the same change that moves a work package's status in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) or resolves a register entry: adjust the row in §2, move items out of §4, and refresh the snapshot numbers in §1 from the last full gate. Keep the plan as the authoritative per-package status text; this document summarizes it.
