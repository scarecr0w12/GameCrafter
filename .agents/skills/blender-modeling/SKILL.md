---
name: blender-modeling
description: "Create and refine editable Blender game models: blockouts, hard-surface or organic forms, retopology, normals, pivots, UV preparation, LODs and collision meshes. Use for modeling tasks and generated-mesh cleanup before export; verify installed Blender capabilities and target-engine requirements."
license: Apache-2.0
metadata:
  gamecrafter-version: "1.0.0"
---

# Blender modeling

Produce editable geometry whose form, topology and export behavior match its game use.
These are recommended authoring procedures, not claims that GameCrafter has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Reference views, actual dimensions and intended camera range.
- Static or deforming use, contact surfaces and interaction needs.
- Installed Blender version and available automation interface.
- Topology, material, LOD and collision budgets.
- Existing source and target import requirements.
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

1. Inspect the existing scene, object hierarchy, dimensions and modifiers before editing.
2. Save a working copy or versioned checkpoint that preserves the incoming asset.
3. Set a scale reference and block the major masses without surface detail.
4. Review silhouette from the gameplay camera and secondary views.
5. Use a modifier-based construction where it keeps form decisions editable.
6. Allocate geometry to curvature, silhouette and deformation rather than uniform density.
7. Keep bevel dimensions proportional to the intended real scale.
8. For organic assets, separate sculpt detail from the lower-density game mesh.
9. Retopologize around joints, facial deformation and important silhouette changes.
10. Inspect accidental duplicate vertices, internal faces and degenerate geometry.
11. Treat open boundaries according to asset purpose; do not demand watertightness for every game mesh.
12. Check face orientation and shading under a simple neutral material.
13. Set hard edges and smoothing intentionally, then inspect the triangulated export copy.
14. Place pivots at the interaction point or modular snapping reference.
15. Prepare UV seams and material boundaries in coordination with the texture workflow.
16. Create collision and LOD variants without modifying the editable master destructively.
17. Export a representative mesh and compare dimensions, normals and counts after reimport.
18. Deliver the Blender source, construction notes, export mesh and validation evidence.

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
