---
name: unreal-development
description: "Implement, debug, profile, and package Unreal Engine C++ and Blueprint gameplay or editor changes. Use for Unreal projects, broken Blueprint behavior, engine build failures, or measured runtime optimization."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
  gamecrafter-engines: unreal
---

# Develop and validate Unreal projects

## Scope and preparation

Read the Project AGENTS.md, relevant design canon, and the task's acceptance criteria.
Inspect current edits before touching files; preserve unrelated work.
Use the existing engine, language, plugins, and architecture unless the task changes them.
Treat the procedures below as GameCrafter engineering recommendations.
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

## Unreal workflow

### Establish the project boundary

Read the .uproject engine association and identify the actual selected installation.
Inspect Source modules, target files, enabled plugins, maps, and config overrides.
Distinguish editor-only authoring code from runtime code and packaged dependencies.
Discover Blueprint/asset editing support before promising graph mutations.
Use a supported editor API or connector for .uasset changes; do not patch binary bytes.

### Implement behavior

Locate the owning Actor, Component, subsystem, Blueprint Class, and existing interfaces.
Prefer a reusable Blueprint Class for behavior instantiated across levels.
Keep level-specific sequencing in the appropriate level context.
Use events/delegates for event-driven work; inspect Tick logic when investigating cost.
Consider native C++ for demonstrated expensive per-frame work, with a measured reason.
Review reflection/property exposure and serialized defaults after changing C++ interfaces.
Compile affected code and Blueprints using available project tooling.
Reopen representative affected assets to detect broken references or defaults.

### Diagnose and measure

Record map, pawn/controller, input, spawn conditions, and reproduction sequence.
Capture the first relevant compile/runtime log error and its asset or call site.
Check ownership, lifetime, initialization, replication role, and asset availability.
Change one supported hypothesis, then replay the same sequence.
Capture Unreal Insights when an observed performance problem requires timing evidence.
Keep .utrace artifacts and record workload/build/hardware for comparison.
Do not use editor frame time as a claim about packaged target-device performance.

### Test and package

Select engine automation, level Functional Testing, or visual comparison by failure type.
Initialize tests independently and clean up files created by the test.
Run a focused test set and retain exported automation results when supported.
Use project launch profiles or established build scripts to produce UAT arguments.
Check platform SDK availability and selected Development/Shipping configuration.
Treat build, cook, stage, package, deploy, and run as separate outcomes.
Inspect included maps and cooked assets before launching the packaged reproduction.

### Completion criteria

The changed code/assets compile in the selected installed engine.
The original runtime reproduction passes or the missing runtime capability is named.
Required tests and package checks have actual artifacts, not just scheduled jobs.
Serialized asset/default changes are listed for review.
Performance conclusions state capture conditions and measured evidence.
