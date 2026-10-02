---
name: visual-consistency
description: "Establish and apply coherent game art direction across characters, environments, props, sprites, materials, lighting and generated assets. Use for style briefs, reference boards, asset-family reviews, visual drift and art acceptance; preserve discovery and distinguish concept images from engine evidence."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Visual consistency

Make assets read as one authored world through explicit visual rules and repeatable comparisons.
These are recommended authoring procedures, not claims that PlayWeld has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Approved visual references and their rights/provenance.
- Gameplay perspective, scene scale and readability goals.
- Existing representative assets and intentional style exceptions.
- Palette, shape language, detail hierarchy and material vocabulary.
- Requested output: direction study, editable asset or engine review.
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

1. Extract observable rules from references: proportions, contour rhythm, value grouping and detail placement.
2. Distinguish user-confirmed art decisions from your proposed interpretations.
3. Build a compact reference board with annotations explaining each reference contribution.
4. Define a shape vocabulary for friendly, hostile, natural and manufactured forms where relevant.
5. Define palette families by role and value range rather than assigning every asset identical colors.
6. Set a detail hierarchy that preserves focal shapes at gameplay distance.
7. Select representative anchor assets to compare all future work against.
8. Prepare contact sheets at the same framing, exposure and background.
9. Evaluate silhouette before surface ornament so texture detail cannot hide proportion drift.
10. Compare material response under common lighting and identify whether mismatch is material or exposure.
11. Review scale relationships with a character or other agreed reference object.
12. Inspect grayscale readability and separation from representative backgrounds.
13. Review 2D and 3D assets at their actual presentation size, including animation.
14. Record intentional departures with a reason tied to story, function or region.
15. Revise the smallest rule or asset subset that resolves the visible disagreement.
16. Keep rejected studies available with concise rejection reasons to avoid repeated drift.
17. If engine lighting changes the look, capture the engine and revise the scene or asset with evidence.
18. Deliver the art brief, comparison sheet, approved examples and unresolved creative choices.

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
