# GameCrafter documentation

**Last updated:** 2026-10-01

GameCrafter is a local game-development workspace with a Theia desktop Control Room, a persistent platform service, model-assisted agents, and engine/DCC integrations. These guides explain the current repository. Design documents describe the complete target system; verification records identify which capabilities have actual live evidence.

## Guides by audience

| Reader or task                         | Start here                                            | Coverage                                                                                             |
| -------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| New user                               | [User guide](USER_GUIDE.md)                           | Setup, Projects, Control Room views, models, chat, agents, assets, knowledge, approvals              |
| System maintainer                      | [Operations guide](OPERATIONS_GUIDE.md)               | Service lifecycle, storage, credentials, backup/restore, diagnostics, release and dependency audit   |
| Contributor                            | [Developer guide](DEVELOPER_GUIDE.md)                 | Repository setup, contracts, typed client, code conventions, meaningful tests, documentation updates |
| Integration author                     | [Integration guide](INTEGRATION_GUIDE.md)             | Engine layers, MCP, DCC, skills, roles, plugin SDK, provider boundaries                              |
| Architecture reviewer                  | [System architecture](SYSTEM_ARCHITECTURE.md)         | Components, ownership, data flows, persistence, task lifecycle, trust boundaries                     |
| API consumer                           | [RPC reference](API_REFERENCE.md)                     | All 186 requests, 28 notifications, error codes, complete machine-readable schemas                   |
| Administrator configuring defaults     | [Settings reference](SETTINGS_REFERENCE.md)           | All 75 builtin settings, defaults, valid scopes, value schemas                                       |
| Game-development agent or skill author | [Game-development skills](GAME_DEVELOPMENT_SKILLS.md) | Bundled skills, domain coverage, reference loading, research and evaluation evidence                 |

## Versioned builds

See the [release and local Windows testing guide](RELEASE_GUIDE.md) for version/tag agreement, GitHub draft prereleases, checksums, package commands and isolated local test launchers. [0.1.1 testing notes](releases/v0.1.1.md) describe the contents and limitations. [Release acceptance](RELEASE_ACCEPTANCE.md) records source identity, local packaging, runtime/UI verification, and hosted publication results.

## Design authority

- [Platform design](PLATFORM_DESIGN.md) owns user-confirmed requirements and the complete product design.
- [Technical architecture](TECHNICAL_ARCHITECTURE.md) owns selected engineering defaults.
- [Skills, agents, and tools](SKILLS_AGENTS_AND_TOOLS.md) owns extension and connection contracts.
- [Decision register](OPEN_DECISIONS.md) retains decisions and verification questions in place.
- [Development plan](DEVELOPMENT_PLAN.md) is the sole authority for work-package status and dependency ordering.
- [Implementation status](STATUS.md) summarizes existing behavior and remaining work by area.
- [Repository instructions](../AGENTS.md) govern code and documentation changes.

These guides do not confirm new requirements, settle open product decisions, or expand an engine acceptance result into a guarantee for every engine version or production Project.

## Verification and research

| Record                                                      | What it establishes                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Full project review](FULL_PROJECT_REVIEW.md)               | Repaired code defects, package tests, dependency audit, remaining implementation gaps           |
| [Program review](PROGRAM_REVIEW.md)                         | Earlier native Windows UI, packaging, service, and Blender evidence                             |
| [Live engine acceptance](LIVE_ENGINE_ACCEPTANCE.md)         | Disposable Unity/Unreal Windows fixtures, tests, packaging, players and access-policy checks    |
| [Extended engine acceptance](EXTENDED_ENGINE_ACCEPTANCE.md) | Real editor identity/screenshot, rendering, audio, WebGL input and additional installed targets |
| [Research library](research/)                               | Dated, sourced engine, asset, protocol and production workflow notes                            |

On 2026-10-01, the extended acceptance record reports 33 successful repository tasks on Linux and Windows, 426 Linux tests, 414 Windows tests with 12 explicit skips, plus separate live-engine fixture results. A fixture test proves the named operation on that fixture and host. It does not certify an existing game, production frame budget, installer lifecycle, or every integration.

## Keeping documentation current

When changing behavior, update the relevant guide and evidence record. Changes to work-package or decision status also require a matching [status](STATUS.md) update. Generate RPC and settings references after building their source packages:

```bash
npm run build
node scripts/generate-system-reference.cjs
node scripts/generate-system-reference.cjs --check
bash scripts/check-links.sh
```

Generated references export the complete schemas as JSON under [reference/](reference/). They omit runtime secrets. Review links, examples, and the distinction between implemented, fixture-tested and live-verified behavior before publishing documentation.
