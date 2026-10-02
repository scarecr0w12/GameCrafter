---
name: materials-textures
description: "Author game materials, UVs and textures, including PBR channel contracts, procedural-to-image baking, normal maps, trim sheets, atlases and texture optimization. Use for Blender-to-engine appearance differences, bake artifacts, color-space issues and texture budgets."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Materials and textures

Produce predictable material response and texture delivery across authoring tools and the selected engine.
These are recommended authoring procedures, not claims that PlayWeld has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Art direction, surface references and target renderer/version.
- UV layout, material slots, high/low meshes and texture source.
- Channel packing, normal convention and color-space requirements.
- Texture resolution, memory, sampler and material budgets.
- Expected tiling, masking, transparency and shader features.
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

1. Write the destination material contract before authoring or baking channels.
2. Identify color information separately from numeric data maps.
3. Check the actual consumer shader and importer rather than assuming matching channel names mean matching semantics.
4. Create a neutral lighting preview and an engine comparison scene.
5. Unwrap with seams based on visibility, shading and expected material boundaries.
6. Use a checker pattern to review stretch and scale across surfaces.
7. Choose texture density from gameplay distance and focal importance.
8. Document intentional overlap, mirroring, tiling or trim-sheet reuse.
9. Pack UV islands with margins suited to final resolution and filtering.
10. Author broad base-color, roughness and metallic behavior before fine wear.
11. Keep lighting information out of base color unless the approved style requires it.
12. Prepare the low/high pair and an explicit bake target on the export copy.
13. Run a small bake to expose cage, ray-distance and seam errors.
14. Inspect normal orientation and tangent response in the destination renderer.
15. Save images and test loading from a clean dependency directory.
16. Pack channels only after verifying the consumer contract and inspect each channel separately.
17. Reduce resolution or compress selectively, comparing close and distant views.
18. Deliver editable texture/material sources, UV and channel notes, export images and comparisons.

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
