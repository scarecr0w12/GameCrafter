---
name: gameplay-implementation
description: "Implement a gameplay mechanic from agreed rules into an existing engine project, including input, state transitions, lifecycle, feedback, persistence boundaries, and validation. Use for player actions, combat, interactions, inventory, progression, or NPC gameplay behavior."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Implement observable gameplay behavior

## Scope and preparation

Read the Project AGENTS.md, relevant design canon, and the task's acceptance criteria.
Inspect current edits before touching files; preserve unrelated work.
Use the existing engine, language, plugins, and architecture unless the task changes them.
Treat the procedures below as PlayWeld engineering recommendations.
Vendor facts and version boundaries are identified in the linked workflow reference.
Read [references/workflows.md](references/workflows.md) for examples and failure diagnosis.

1. Identify the project root, engine executable, actual engine version, and target platform.
2. Record renderer/render pipeline, language, plugins, SDKs, and enabled test facilities.
3. Discover available connector tools and their schemas before planning editor mutations.
4. Check the current access mode and operation permissions through the platform/tool broker.
5. Use existing authorization; ask only for genuinely missing authority or product decisions.
6. Choose the smallest change that demonstrates the requested observable behavior.

Skill metadata is advisory; it grants no filesystem, process, editor, or network permissions.
An installed skill does not imply that an engine executable or compatible connector exists.
Do not invent MCP tool names, test runners, package dependencies, or binary asset formats.
For a missing capability, continue useful source inspection and report the exact missing step.

## Execution discipline

Keep editor mutations within the requested project and assets.
Use argument arrays or correctly quoted shell arguments for paths with spaces.
Capture the working directory, executable, arguments, configuration, and timeout.
Avoid writing output over source content or another task's artifacts.
Use a task-specific artifact directory selected under the current access policy.
Coordinate access to a project already open in an editor.
Do not discard unsaved user changes to make automation convenient.
Stop a hung process using the supported task cancellation mechanism.
Report a timeout as incomplete verification, preserving available diagnostics.

Separate these evidence levels in every result:

- Source inspection: a finding supported by code or asset references.
- Static checks: parsing, linting, or compilation without gameplay execution.
- Engine checks: import, editor compilation, or engine-integrated test results.
- Runtime checks: actual game/scene behavior with recorded steps and observations.
- Packaged checks: behavior from the exported or packaged artifact.
- Device checks: execution on the named target hardware/platform.

Passing one level does not establish the later levels.
Use narrow checks while iterating, then the project's required verification before completion.
Fix the first relevant error before treating cascaded errors as separate causes.
Retain the original reproduction and repeat it after changing code or content.

## Output contract

Return a concise result with reviewable files and evidence:

- Requested behavior and acceptance criteria addressed.
- Engine version, project path, target, configuration, and connector used.
- Files/assets changed and the reason for each material change.
- Checks actually executed, their results, and artifact/log locations.
- Remaining failed, skipped, or unsupported checks with concrete prerequisites.
- Any observed risk to references, saved state, packaging, or performance.

Label illustrative commands and example outcomes as examples.
Do not describe researched procedures as tested implementations.
Do not infer gameplay correctness from a screenshot, import, or successful exit alone.
Do not infer performance improvement without comparable measurements.

## Gameplay implementation workflow

### Resolve the rules before editing

Read the feature's agreed rules, existing domain vocabulary, and acceptance criteria.
Specify triggers, preconditions, state transitions, effects, cancellation, and feedback.
Include invalid inputs and boundary cases already implied by the feature.
Use project conventions for units, update timing, resource identity, and ownership.
Bring genuinely undecided product rules to the user; resolve routine code choices locally.
Do not invent reward balance, art direction, or progression rules to fill coding gaps.

### Find the owning subsystem

Identify the existing player/controller, actor/component, scene, and data model.
Separate simulation state from UI/audio/VFX feedback where the project architecture does.
Keep durable records in the platform service when changing PlayWeld platform code.
For a game project, use that project's established save/persistence architecture.
Avoid turning transient animation state into the authoritative gameplay rule.
Review authority and replication only if the project mechanic involves multiplayer.
Reuse existing input abstractions and resource definitions.

### Implement a vertical behavior slice

Write the smallest end-to-end action before broadening variants.
Connect input to rule evaluation, state change, feedback, and the required persistence hook.
Handle setup, scene/world reload, disabling, destruction, and teardown.
Make repeated inputs and cancellation follow the specified semantics.
Keep reusable engine objects independent of hidden level/parent references.
Preserve serialized fields, asset identities, prefab overrides, and resource references.
Use actual engine APIs/connectors for scene and asset authoring.

### Validate the player-visible outcome

Check normal action, rejected action, repeated action, and relevant boundary values.
Verify the state change and the feedback; an animation alone is not a rules check.
Use focused pure tests for rules and engine tests for lifecycle/input/world interactions.
Replay the mechanic in the representative gameplay scene.
For persistence, reload using the real save path and inspect the restored behavior.
For multiplayer, verify the actual requested roles and supported topology.
Keep art placeholders and prototype content labeled honestly.

### Debug and hand off

Record a deterministic reproduction before changing an observed bug.
Inspect logs and runtime values at the rule transition that diverges.
Profile only when a measured performance requirement or regression warrants it.
Document the final rule, owning module, changed content, and actual validation.
Do not expand into unrelated mechanic redesign while fixing the requested behavior.
Leave reviewable boundaries for designers to tune existing data-driven parameters.
