---
name: engine-integration-tests
description: "Create and run integration tests that exercise a real Unity, Unreal, or Godot project across engine lifecycle, scenes, assets, packaging, and connectors. Use when unit tests miss engine behavior or live-engine evidence is required."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Design and execute engine integration tests

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

## Integration test workflow

### Choose the behavior boundary

Turn the requested behavior into inputs, observable outputs, and invariants.
Identify which engine facility must actually execute for the claim to be meaningful.
Examples include scene instantiation, physics, lifecycle ordering, import, and packaging.
Separate a connector transport test from the gameplay test it invokes.
A fake connector test establishes platform behavior against the fake, not engine behavior.
Use available project tests before introducing a new framework or plugin.

### Build a controlled fixture

Choose the smallest representative scene/map/prefab and dependencies.
Record startup map, inputs, seeds, configuration, target, and expected completion.
Use an observable readiness condition instead of guessing a fixed startup delay.
Use supported engine APIs for deterministic setup and cleanup.
Avoid relying on a previous editor session, test order, or dirty saved state.
Test meaningful outcomes such as damage applied, scene loaded, or item persisted.
Avoid tests that simply restate the implementation's internal function calls.

### Select the engine runner

Unreal: choose Functional Testing for level behavior or appropriate Automation tests.
Unreal: export selected automation results where the executable supports the workflow.
Unity: choose EditMode, PlayMode, or Player tests according to the engine boundary.
Unity: inspect the installed Test Framework version and result XML.
Godot: discover a project test harness or implement a focused project-owned scene runner.
Godot: use script parsing/import checks as prerequisites, not gameplay assertions.
Do not invent a built-in Godot equivalent of Unity's test-platform command.

### Execute and interpret

Start from a clean test fixture without discarding unrelated user edits.
Capture engine version, executable, arguments, logs, test report, and timeout.
Require expected assertions and result counts, not merely a zero process exit.
Distinguish harness startup failure from the game's behavior failing an assertion.
For crashes or hangs, preserve partial logs and report incomplete test execution.
A retry passing after a failure does not erase the original failure.
Investigate resource loading, timing, seed, and teardown when results are intermittent.

### Extend the boundary when required

Run packaged tests when editor-only behavior can conceal a defect.
Use target-device tests when platform SDK, rendering, input, or performance differs.
Test multiplayer with explicit roles and instance configuration when in scope.
Do not call one local process a verified distributed multiplayer topology.
List the live matrix actually exercised and the matrix still proposed.
