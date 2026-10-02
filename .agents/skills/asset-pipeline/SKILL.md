---
name: asset-pipeline
description: "Plan, export, integrate and validate game assets across DCC tools and Unity, Unreal or Godot. Use for source-to-engine handoffs, generated asset cleanup, interchange problems, asset budgets, LODs, collision and production-readiness evidence."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Asset pipeline

Carry an asset from editable source to a measured target-engine result with traceable evidence.
These are recommended authoring procedures, not claims that GameCrafter has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Asset role, gameplay camera and target engine/version.
- Existing source, ownership/license and generation provenance.
- Delivery formats, target platform and supported import extensions.
- Triangle, material, texture, memory and animation budgets.
- Collision, LOD, socket and naming requirements.
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

1. Inventory source files, external dependencies and existing import settings before changing anything.
2. Classify the request as art exploration, export cleanup, engine integration or production validation.
3. Choose an interchange format from the actual consumer capabilities; avoid making glTF universal by assumption.
4. Record units, axis orientation, pivot, intended dimensions and transform policy.
5. Keep an editable master and create a separate export collection or copy.
6. Measure source geometry, material slots, textures, skeletons and animation clips.
7. Remove accidental unused data from the export copy while retaining intentional variants in source.
8. Convert unsupported procedural content only where necessary and keep the original construction history.
9. Export a small representative object first to expose coordinate and material incompatibilities.
10. Run structural validation appropriate to the format and preserve the complete report.
11. Inspect the export in an independent viewer, including backsides and animation clips.
12. Import into an isolated target-engine test scene using recorded importer settings.
13. Check scale, pivot placement, shading, transparency, collision, animation and dependency resolution.
14. Construct LOD and collision variants from actual viewing and gameplay requirements.
15. Profile representative simultaneous instances on the target renderer and hardware class.
16. Compare measured values with project budgets and document exceptions with a visible consequence.
17. Repeat export and import after fixes so reports describe the current artifact.
18. Deliver the editable master, exported payload, dependencies, settings and evidence together.

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
