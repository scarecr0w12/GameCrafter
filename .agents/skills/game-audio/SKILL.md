---
name: game-audio
description: "Produce and integrate game sound effects, ambience, music and dialogue with editable masters, loop points, spatialization, mix targets and runtime budgets. Use for audio asset preparation, clicks, loudness mismatches, loop seams, import settings and overlapping-voice validation."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game audio

Deliver sound that supports gameplay timing, spatial meaning and an intelligible runtime mix.
These are recommended authoring procedures, not claims that GameCrafter has implemented these tools.
Apply the workflow across engines by inspecting the actual target and installed versions.

## Required context

- Sound role, trigger timing, spatial behavior and mix priority.
- Source/DAW files, rights and recording/generation provenance.
- Target engine, playback API and codec support.
- Loop policy, duration, variation and concurrency limits.
- Runtime memory/CPU budget and project loudness/headroom targets.
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

1. Inventory source recordings, session dependencies and existing import settings.
2. Define audible intent and gameplay synchronization for each sound.
3. Keep pristine editable masters and create runtime variants separately.
4. Remove accidental leading silence without cutting the intended attack.
5. Inspect waveform and listen for clipping, clicks and noise in quiet passages.
6. Apply processing for the sound role rather than normalizing every asset identically.
7. Preserve dynamic contrast between background and urgent feedback.
8. Choose mono/stereo according to spatialization and artistic intent.
9. Choose codec and sample rate from the actual consumer and concurrency budget.
10. Define loop start/end coordinates with explicit sample or second units.
11. Check loop transitions by listening to repeated playback after encoding.
12. Create variation sets for repeated actions and review tonal consistency.
13. Import into the target engine and record conversion/compression settings.
14. Test attenuation, buses, effects and listener-relative behavior.
15. Trigger simultaneous sounds to evaluate masking, clipping and voice stealing.
16. Confirm pause, restart and looping lifecycle events behave as expected.
17. Measure memory and playback cost using representative concurrent voices.
18. Deliver source/session, runtime files, cue table, settings and listening evidence.

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
