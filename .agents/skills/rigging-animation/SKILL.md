---
name: rigging-animation
description: "Prepare game skeletons, skin weights, animation clips, retargeting and root motion; bake authoring rigs to exportable motion and validate deformation in Unity, Unreal or Godot. Use for rig/clip handoffs, animation drift, loop seams and importer mismatches."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Rigging and animation

Deliver controllable motion with verified skeleton, clip and deformation behavior in the selected engine.
These are recommended authoring procedures, not claims that GameCrafter has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Character topology and intended movement/action vocabulary.
- Skeleton contract, root-motion policy and retargeting target.
- Installed DCC/exporter and engine/importer versions.
- Influence, joint, clip and runtime memory budgets.
- Clip names, durations, frame rate and gameplay event timing.
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

1. Inspect the rig hierarchy and rest pose before changing transforms.
2. Agree joint naming, skeleton orientation and root-motion ownership.
3. Preserve the authoring rig and create a separate export rig/copy if needed.
4. Place joints for plausible articulation and evaluate the actual mesh volume.
5. Bind weights and identify unweighted or unexpectedly influenced vertices.
6. Normalize relevant deform weights and respect the target influence limit.
7. Test shoulders, hips, knees, fingers and facial extremes before clip polishing.
8. Correct topology or joint placement when weights alone cannot solve deformation.
9. Define each clip range, duration, loop policy and in-place/root-motion behavior.
10. Animate readable anticipation, action and recovery around gameplay timing.
11. Check feet, hands and contact surfaces for unintended sliding.
12. Bake evaluated constraints or drivers into keys where export requires it.
13. Export a diagnostic clip before batching all clips.
14. Inspect exporter action-slot/NLA behavior against the installed version.
15. Verify exported clip inventory and skeleton rather than trusting source track names.
16. Import and compare rest pose, duration, joint extremes and root displacement.
17. Test loops and transitions in the destination animation system.
18. Deliver source rig, export skeleton/clips, event timing notes and playback evidence.

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
