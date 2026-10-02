# Bundled game-development skills

GameCrafter ships 30 first-party Agent Skills, with detailed workflows and examples
in each skill's `references/workflows.md`. These are original Apache-2.0 instructions,
not copies of engine manuals. Research notes preserve sources and edition boundaries.

The platform service copies the curated library into its build, so a packaged
installation does not require this repository or an online skill marketplace.
The library uses standard `SKILL.md` directories and namespaced metadata.
The [Agent Skills specification](https://agentskills.io/specification) describes this
format and progressive disclosure; [creation guidance](https://agentskills.io/skill-creation/best-practices)
recommends focused procedures, examples, and validation loops.

## Coverage

| Area                           | Bundled skills                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordination and design        | [game-development](../.agents/skills/game-development/SKILL.md), [game-design-review](../.agents/skills/game-design-review/SKILL.md), [level-design](../.agents/skills/level-design/SKILL.md), [project-planning](../.agents/skills/project-planning/SKILL.md)                                                                                                      |
| Narrative and NPC behavior     | [narrative-style-guide](../.agents/skills/narrative-style-guide/SKILL.md), [game-ai](../.agents/skills/game-ai/SKILL.md)                                                                                                                                                                                                                                            |
| Engine implementation          | [unreal-development](../.agents/skills/unreal-development/SKILL.md), [unity-development](../.agents/skills/unity-development/SKILL.md), [godot-scene-audit](../.agents/skills/godot-scene-audit/SKILL.md)                                                                                                                                                           |
| Coding and review              | [gameplay-implementation](../.agents/skills/gameplay-implementation/SKILL.md), [game-code-review](../.agents/skills/game-code-review/SKILL.md), [security-review](../.agents/skills/security-review/SKILL.md)                                                                                                                                                       |
| Asset coordination and style   | [asset-pipeline](../.agents/skills/asset-pipeline/SKILL.md), [visual-consistency](../.agents/skills/visual-consistency/SKILL.md)                                                                                                                                                                                                                                    |
| Meshes, textures and animation | [blender-modeling](../.agents/skills/blender-modeling/SKILL.md), [materials-textures](../.agents/skills/materials-textures/SKILL.md), [rigging-animation](../.agents/skills/rigging-animation/SKILL.md)                                                                                                                                                             |
| 2D, sound and effects          | [sprite-production](../.agents/skills/sprite-production/SKILL.md), [game-audio](../.agents/skills/game-audio/SKILL.md), [technical-art-vfx](../.agents/skills/technical-art-vfx/SKILL.md)                                                                                                                                                                           |
| Multiplayer                    | [multiplayer-gameplay](../.agents/skills/multiplayer-gameplay/SKILL.md)                                                                                                                                                                                                                                                                                             |
| Player access and languages    | [game-accessibility](../.agents/skills/game-accessibility/SKILL.md), [game-localization](../.agents/skills/game-localization/SKILL.md)                                                                                                                                                                                                                              |
| Validation and delivery        | [test-driven-development](../.agents/skills/test-driven-development/SKILL.md), [engine-integration-tests](../.agents/skills/engine-integration-tests/SKILL.md), [game-performance](../.agents/skills/game-performance/SKILL.md), [game-build-release](../.agents/skills/game-build-release/SKILL.md), [evidence-review](../.agents/skills/evidence-review/SKILL.md) |
| Research and team records      | [source-research](../.agents/skills/source-research/SKILL.md), [discussion-board-maintenance](../.agents/skills/discussion-board-maintenance/SKILL.md)                                                                                                                                                                                                              |

This is a broad production workflow library, not an assertion that every genre,
engine extension, console SDK, or specialist discipline is exhaustively documented.
Project-local skills and plugins can add deeper project-specific procedures.

## Use in the Control Room

Open **Skills & Roles** and choose a Project. Bundled entries are labeled **Bundled**
and enabled by default. Disable or constrain them by role/work type using the same
Project controls as installed platform skills. Engine tags hide incompatible engine
procedures from the eligible catalog. Use **Read guide** to browse an eligible skill's
instructions and references, with paging for longer documents.

A Project-local skill overrides the same name and requires Project trust before activation. An enabled installed platform
or plugin skill overrides the bundled version; compatibility-scanned skills have
lower priority. Project settings are keyed by skill name, including pins. Replacing
that name can therefore require reviewing a pin before the replacement can activate.
Bundled copies are application assets, so their UI does not offer Uninstall; removing
an installed override exposes the bundled copy under the current Project settings.

Bundled instructions do not grant execution permissions or bypass Project trust.
Imported Project-local or compatibility instructions remain unavailable until trust
is granted. Capabilities, access ceilings, approvals, and resource locks still apply
to the actual operation.

## Use in agent tasks

Existing builtin roles now have all their recommended skills available. The runtime
preloads role recommendations, offers eligible discovery, and protects activated
instructions during compaction. Additional skills can be selected during a task.

1. Call `skills/search` with a focused task query.
2. Call `skills/activate` with an eligible name to load its instructions and inventory.
3. Call `skills/read-resource` with `name` and an inventoried `resource`, or `SKILL.md`.
4. Continue from `endLine + 1` when `truncated` is true.

The RPC equivalent also requires `projectId`; optional `taskId` applies task-specific
eligibility. Reads default to 200 lines, cap at 500 lines, limit file text to 256 KiB
and response text to 64 KiB, and reject binary/invalid UTF-8, unlisted paths and
symlink escapes. Results include schema version, inventory hash and line positions.
Reading a script is distinct from executing it.

## Research basis and version boundaries

Last researched: **2026-10-01**.

- [Engine workflows](research/game-engine-workflows.md): Unreal 5.6, Unity 6000.0,
  Unity Test Framework 1.4, Godot 4.4 documentation baselines.
- [Asset workflows](research/game-asset-workflows.md): official Aseprite, Blender,
  Khronos, Godot and Audacity sources; blocked Blender pages and older/development
  references are explicitly qualified.
- [Systems workflows](research/game-systems-workflows.md): prototyping, narrative,
  architecture, networking, tests, accessibility, localization, profiling and release.

These reference editions are reproducible research baselines, not assertions about
latest releases or versions installed on a user's machine. Procedures require actual
version and capability discovery. Research-supported instructions do not establish
that an engine/DCC operation was executed successfully by GameCrafter.

## Maintenance and validation

Author first-party skills in `.agents/skills/`. Add production names to
`packages/platform-service/src/skills/bundled-skill-names.ts`; the build explicitly
copies those directories and removes stale bundled directories. Repository authoring
tools are not automatically included in the application.

Keep main instructions below 500 lines and supporting documents focused. Preserve
clear triggers, concrete examples, failure diagnoses, output contracts and validation
steps. Add realistic prompts under `evals/evals.json`; compare guided and unguided
responses when changing guidance substantially. Qualitative workflow evaluations do
not substitute for engine execution or gameplay tests.

The test suite validates metadata, resource availability, role recommendation
coverage, engine tags, packaging, startup discovery, eligibility, Project disablement,
overrides, reference pagination and rejected access cases. Documentation checks verify
local links. Live target-engine acceptance remains a separate evidence requirement.

Verified on 2026-10-01: 418 Linux tests pass; 406 Windows tests pass with 12 OS/capability skips. Both targets pass all 33 task gates and build the browser/Electron applications. Live UI smoke passes 26 browser checks and 23 native Windows Electron checks with no renderer errors, including reader visibility and Project controls. Two paired qualitative scenarios cover asset-handoff and engine-evidence guidance; their guided outputs meet all 9 assertions, without establishing live engine execution or general superiority. See [status evidence](STATUS.md#bundled-game-development-guidance).

Selected Unity and Unreal workflows now have separate [live acceptance evidence](LIVE_ENGINE_ACCEPTANCE.md): Unity 6000.6.0f1/Test Framework 1.8.0 and Unreal 5.8.3 on Windows, real assertions, access policy, Development packaging and headless built-player checks. The reference pages for those engines and engine integration link that exact matrix. Other versions, editor MCP, graphics and asset/DCC workflows still require their own acceptance.
