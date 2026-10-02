---
name: technical-art-vfx
description: "Author and integrate game particles, effect materials, flipbooks, procedural art and shader-driven feedback. Use for readable VFX timing, transparent effects, particle bounds, local/world behavior, performance budgets, shader portability and target-engine verification."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Technical art and VFX

Make effects communicate game events clearly while respecting rendering and simulation constraints.
These are recommended authoring procedures, not claims that PlayWeld has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Gameplay event, anticipation/impact/recovery timings and readability.
- Art direction, camera range, effect scale and background scenes.
- Target renderer, shader features and supported particle tooling.
- Concurrent effect, overdraw, memory and frame-time budgets.
- Flipbook/material source and required collision or attachment behavior.
  Use existing Project context and accepted decisions before asking for missing information.
  State reversible working assumptions and proceed with a small representative example.
  Escalate only creative choices or requirements that materially change the requested result.

## Scope and handoff

Keep concept work within the requested visual or audio scope until implementation is requested.
Select the smallest useful artifact that exposes the key uncertainty.
Use available DCC/editor interfaces; inspect tool help and scene state before scripting mutations.
Do not claim an external job completed merely because it was accepted or returned a job identifier.
Wait for completion, save outputs, inspect them and record provider errors when generation is used.
Retain provenance and source files so future corrections remain possible.
Read [detailed workflows](references/workflows.md) for examples, diagnosis and delivery checks.
Use `asset-pipeline` for broader source-to-engine coordination where this domain hands off.

## Procedure

1. Define the effect event and the information the player should perceive.
2. Break the effect into anticipation, impact, sustain and recovery where applicable.
3. Set scale and timing against a gameplay actor and actual camera.
4. Build primary shapes before adding secondary sparks, noise and debris.
5. Preserve material graphs, source textures and procedural setup as editable assets.
6. Prepare flipbook frame order, duration and alpha contract explicitly.
7. Check transparent borders against light/dark backgrounds and overlapping effects.
8. Choose local/world coordinates according to attachment and trail behavior.
9. Set emission, lifetime and restart behavior deliberately.
10. Configure visibility bounds to cover the actual simulated effect trajectory.
11. Treat particle collisions as a distinct simulation feature with its own cost and limitations.
12. Review effect readability in motion and around foreground characters.
13. Test moving emitter/parent behavior and camera entry/exit.
14. Measure overlapping transparent layers and simultaneous effect instances.
15. Reduce overdraw, texture size or simulation detail based on the measured bottleneck.
16. Recheck lifecycle cleanup and repeated triggers after optimization.
17. Capture direct target-engine appearance and profile results separately from art previews.
18. Deliver source graphs/textures, effect prefab/scene, settings and evidence.

## Working discipline

Save a checkpoint before edits that discard construction history or source detail.
Use an export copy for conversion, flattening, baking or destructive cleanup.
Keep stable names for source, export and imported variants and explain their relationship.
Do not change project-wide import or renderer defaults to conceal one asset problem.
Prefer a controlled comparison that changes one relevant setting at a time.
Inspect actual outputs after automation rather than relying on exit status alone.
If the tool disconnects, inspect saved state before repeating a mutation.
Record incomplete operations and recover from the last verified checkpoint.
Retain failed diagnostic examples when they help explain the chosen correction.
Separate artistic acceptance from structural, engine and performance acceptance.

## Evidence gates

- **Art study:** a preview demonstrates intent; integration and runtime suitability remain open.
- **Editable source:** a native project opens with its dependencies and construction preserved.
- **Export checked:** the delivery payload was inspected or structurally validated with settings recorded.
- **Import checked:** the actual chosen engine imported the current payload with visible results.
- **Behavior checked:** relevant animation, contact, timing or lifecycle behavior was exercised.
- **Budget checked:** representative target measurements were compared with agreed limits.
  Record each gate independently; a later-looking image does not imply an earlier structural check.
  Use `not run`, `passed with evidence`, `failed` or `not applicable` for relevant checks.
  Explain why a check is not applicable instead of silently omitting it.
  Include artifact paths and tool/version information with each evidence claim.
  Record which exact export/import variant the capture or report describes.
  Do not label an asset production-ready while required gates remain unverified.

## Delivery contract

Provide the editable source and all required dependent files.
Provide exported runtime artifacts and their naming/placement convention.
Provide a compact settings record sufficient to repeat the handoff.
Provide the before/after comparison when fixing an existing problem.
Provide measured counts, dimensions, durations or resource values relevant to the domain.
Provide validation reports or captures actually produced during this task.
Identify untested platforms, unsupported features and outstanding acceptance decisions.
Document license/provenance and any restrictions attached to supplied/generated inputs.
Keep temporary studies distinguishable from accepted production content.

## Completion check

- Does the result satisfy the requested purpose at actual gameplay presentation scale?
- Can another author open and modify the source without hidden dependencies?
- Does the current export correspond to the current source revision?
- Were target-specific settings checked rather than inferred from generic format support?
- Do captures and measurements refer to the delivered artifact?
- Are budget exceptions and visible tradeoffs explained?
- Are unverified claims clearly separated from completed work?

## References and version caution

The detailed reference includes primary-source links and source-specific caveats.
Consult the installed tool documentation/help before relying on a menu, flag or exporter mode.
Engine support for a format does not guarantee support for all its extensions or features.
Blender English pages were blocked during the 2026-10-01 research pass.
Blender 4.5 indexed translations/UATEST pages, older weight docs and development bake docs need local verification.
Do not treat indexed summaries or development documentation as installed-version validation.
These procedures authorize work within the user's task; they do not add an approval step.
