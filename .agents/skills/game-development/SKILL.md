---
name: game-development
description: 'Coordinate end-to-end game development from an idea or existing project through design, engine implementation, editable assets, testing, optimization, accessibility, localization, and packaged delivery. Use for broad game-building requests, capability planning, incomplete-project audits, or selecting the right specialist workflows.'
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game development

Turn a player-facing goal into an executable, evidenced change. This is an original
GameCrafter workflow; specialist references supply engine-specific procedures.
Read [the workflow map](references/workflows.md) for task routing, example contracts,
and integration checks. Load the relevant specialist skill before using its procedure.

## Discover the project

Read AGENTS.md and existing canon before proposing a different game.
Record the installed engine/version, language, target platform, renderer, input model,
project structure, repository state, build/test commands, and available connectors.
Use capability reports to distinguish installed tools from callable operations.
Preserve unrelated edits. Inspect existing assets, mechanics, saves, and tests.
If a project is incomplete, inventory concrete failures and reproduction evidence.
Separate missing behavior from deliberately deferred design and speculative improvements.

Capture the requested experience in five statements:

1. Player: who acts, what they can perceive, and what input they use.
2. Loop: action, consequence, feedback, next meaningful decision.
3. Space: movement, camera, interaction distances, obstacles, and boundaries.
4. Progress: persistent state, goals, failure, recovery, and completion.
5. Delivery: supported devices, performance constraints, and expected artifact.

Choose reversible defaults for routine engineering. Ask only for creative decisions
that materially change the experience and cannot be inferred from the brief or canon.
Do useful independent work while a decision is pending.

## Route to focused skills

| Work                                            | Skill                                             |
| ----------------------------------------------- | ------------------------------------------------- |
| Experience, mechanics, prototype questions      | game-design-review                                |
| Traversal, encounters, navigation, blockout     | level-design                                      |
| Dialogue, quests, characters, story state       | narrative-style-guide                             |
| Unreal implementation and authoring             | unreal-development                                |
| Unity implementation and authoring              | unity-development                                 |
| Godot scenes and implementation                 | godot-scene-audit                                 |
| Mechanics, input, save state, simulation        | gameplay-implementation                           |
| Tests and engine integration                    | test-driven-development, engine-integration-tests |
| Visual direction and asset handoff              | visual-consistency, asset-pipeline                |
| Meshes and UVs                                  | blender-modeling                                  |
| PBR channels, baking, materials                 | materials-textures                                |
| Skeletons, skinning, clips                      | rigging-animation                                 |
| Pixel art, atlases, frame timing                | sprite-production                                 |
| Sound, music, buses, loops                      | game-audio                                        |
| Particles, shaders, technical art               | technical-art-vfx                                 |
| NPC decisions and navigation                    | game-ai                                           |
| Sessions, replication, authority                | multiplayer-gameplay                              |
| Player barriers and interaction alternatives    | game-accessibility                                |
| Strings, fonts, locales, text layout            | game-localization                                 |
| Measured CPU/GPU/memory/loading budgets         | game-performance                                  |
| Packages, installation, save compatibility      | game-build-release                                |
| Code and abuse review                           | game-code-review, security-review                 |
| Dependency planning and evidence                | project-planning, evidence-review                 |
| Primary-source research and decision discussion | source-research, discussion-board-maintenance     |

## Define the integration contract

For each change, write the behavior, owner, dependencies, inputs/outputs, failure
behavior, artifact locations, and the evidence needed to accept it.
Connect creative and engineering constraints: a teleport VFX needs event timing;
a moving platform needs collision and reset behavior; dialogue choices need save keys.
Choose budgets from actual targets rather than copying a universal polygon or FPS rule.
Do not expand an asset's scope merely because a generation provider can produce more.

Implement a playable vertical path through the affected systems before multiplying content.
For a new interaction, connect input → simulation → presentation → persistence → tests.
For a new asset, connect source → export → import → gameplay use → target measurement.
Reuse the project's existing architecture when it supports the behavior cleanly.
Keep editable sources alongside runtime exports according to project conventions.

## Execute and verify

Discover supported tool arguments before invoking an engine or DCC process.
Acquire appropriate shared-session/resource locks through the offered tools.
Serialize commands that mutate the same engine project or editor session.
Use isolated work where supported and preserve the primary project state.
Paid generation, external publication, and destructive actions retain their actual
broker approval/access requirements. A skill never changes those requirements.

Select verification by the failure being prevented:

- Pure rules: deterministic unit checks for state transitions and boundaries.
- Authoring: compile/import and broken-reference inspection.
- Runtime: actual input, collisions, lifecycle, reset, persistence, and failures.
- Visual/audio: representative cameras, lighting, mixes, and enabled settings.
- Multiplayer: separate clients/processes, late joins, loss, and authority checks.
- Delivery: packaged startup, target-device behavior, installation, and updates.

A missing engine or SDK means a live check is unavailable. Complete independent work,
then identify the missing prerequisite and the exact remaining validation.
A successful shell exit is insufficient if the requested test/import/build was skipped.
Read reports and inspect produced artifacts.

## Completion report

Lead with the player-facing result and artifact locations.
Report checks actually executed, versions, commands, result files, and limitations.
Distinguish instructions researched, source checked, unit tested, engine imported,
playtested, packaged, and measured on target hardware.
Record unresolved decisions and failures so the next task can reproduce them.
Avoid labels such as game-ready or production-ready without the supporting checks.
