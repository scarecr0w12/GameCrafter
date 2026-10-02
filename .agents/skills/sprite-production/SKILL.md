---
name: sprite-production
description: "Create editable 2D game sprites, frame animation, tilesets and atlases with consistent scale, anchors, timing and metadata. Use for pixel art, generated sprite cleanup, sprite-sheet export, trimming jitter, palette consistency and engine playback validation."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Sprite production

Turn 2D art into reliable animated frames and atlases while preserving editable sources.
These are recommended authoring procedures, not claims that GameCrafter has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Gameplay view, logical sprite size and art/palette rules.
- Animation states, directions, timings and event frames.
- Anchor/pivot contract and collision expectations.
- Atlas limits, filtering, mipmaps and target importer.
- Editable sources and generation/reference provenance.
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

1. Define logical canvas size, character scale and anchor before drawing frames.
2. Select approved silhouette and palette anchors for the sprite family.
3. Keep layers and source animation editable in the authoring tool.
4. Create key poses before filling intermediate frames.
5. Review silhouette and value separation at actual gameplay size.
6. Keep feet/contact points consistent with the anchor across frames.
7. Separate movement intent from accidental canvas drift.
8. Assign explicit animation tags and per-frame durations.
9. Check directional variants for consistent scale and handedness.
10. For tiles, test seams in a repeated grid and at map borders.
11. Inspect alpha edges over both light and dark backgrounds.
12. Choose trim and packing settings that preserve the original frame rectangle in metadata.
13. Set atlas padding and extrusion from the chosen filtering/mipmap policy.
14. Export image and metadata as one versioned delivery unit.
15. Validate every frame rectangle, duration, tag and referenced image.
16. Play clips at a fixed engine origin to reveal pivot or trimming jitter.
17. Test actual zoom levels, filtering, transitions and event frames.
18. Deliver editable source, atlas/metadata, preview animation and engine evidence.

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
