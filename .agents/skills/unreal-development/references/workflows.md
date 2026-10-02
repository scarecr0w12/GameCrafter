# Practical workflows and evidence

**Last researched:** 2026-10-01

## Version boundary

Reference baselines: Unreal Engine 5.6, Unity 6.0 (6000.0), Unity Test Framework 1.4, and Godot 4.4.
These are documentation editions, not a latest-version claim or a tested support matrix.
Recheck installed-version documentation and executable help before using commands.

A separate [live acceptance record](../../../../docs/LIVE_ENGINE_ACCEPTANCE.md) covers
Unity 6000.6.0f1 with Test Framework 1.8.0 and Unreal 5.8.3 on Windows:
selected engine assertions, access controls, Win64 Development packaging and
headless built-player checkpoint checks. This does not verify other versions,
graphics/input/audio, a live MCP editor bridge, or every workflow in this skill.

## Annotated example: pressure plate fails after level reuse

Request: a door opens when the player overlaps a reusable plate in either test map.
Inspect the existing Level Blueprint and the plate's Actor Blueprint first.
Hypothesis: the Level Blueprint references the original door instance.
Create or edit a reusable plate class only through discovered editor capabilities.
Expose its intended door dependency using the project's established interface.
Bind overlap behavior once; check that end-overlap follows the specified design.
Compile the affected Blueprint and save only the requested assets.
Test two plate instances against different doors in both maps.
Include an unrelated overlapping Actor to verify the player filter.
Capture the runtime log and actual before/after interaction observations.
A compile pass alone does not prove that either door opens.
If the connector cannot author graph nodes, report that boundary and provide reviewable steps.

### Packaging follow-through

If the request includes packaged behavior, use the existing launch profile.
Record map inclusion, target platform, configuration, and output directory.
Retain UAT/cook logs and launch the produced build against the same interaction.
An editor-only dependency discovered here is a packaging defect to fix within scope.
Do not upload or distribute the build unless that action is authorized.

### Profiling variation

For many plates causing frame spikes, capture the same map and movement path.
Inspect costly Tick behavior before recommending an event-driven rewrite.
Compare captures from the same build mode and representative target hardware.
Report observed CPU timing and any tradeoff, such as altered update frequency.
Do not supply invented speedup percentages.

## Execution record template

Use this checklist to prepare a bounded, repeatable run.

- Project root and relevant map/scene/prefab.
- Actual engine executable path and version output.
- Project-declared version and any mismatch.
- Host OS, target platform, renderer/pipeline, and configuration.
- Language, enabled plugins, and installed test framework.
- Discovered connector/tool schema and operation permissions.
- Current editor session and unsaved changes affecting the task.
- Working directory and argument list.
- Task-specific output location.
- Startup/readiness condition and timeout.
- Assertions or observations needed for success.
- Cleanup procedure and cancellation mechanism.

Retain full engine logs where available.
Inspect result contents, test counts, errors, and skipped tests.
Verify artifacts exist before linking them in the report.
Keep a failed first attempt when a retry is relevant to reliability.
Keep source checks, engine checks, runtime checks, and device checks separate.

## Diagnose failure by stage

| Symptom | First investigation | Evidence to retain |
| --- | --- | --- |
| Executable missing | Actual installation and configured path | Discovery output |
| Engine/project mismatch | Project version and selected binary | Both versions |
| Compilation/import error | First relevant source or resource diagnostic | Full log and path |
| Test runner starts without assertions | Filters, discovery, expected test count | Structured report |
| Scene runs with missing behavior | Input, ownership, references, lifecycle | Reproduction and runtime values |
| Process hangs | Readiness, blocking dialogs, asynchronous waits | Partial log and timeout |
| Package excludes content | Maps/scenes, presets, dynamic resource loading | Build/export log |
| Editor passes, player fails | Editor-only dependencies and platform defines | Player log |
| Frame time regresses | Comparable workload and capture settings | Raw profile artifacts |

A failure in setup is not evidence that the gameplay assertion passed or failed.
A successful command with missing output is incomplete evidence.
Investigate one hypothesis at a time and replay the original reproduction.
Do not broaden edits simply because downstream logs contain many errors.

## Review checklist

- The implementation follows existing ownership and lifecycle rules.
- Asset/resource identity remains consistent after moves or refactors.
- Normal, invalid, repeated, and teardown cases are considered.
- Cleanup touches only test-owned state and artifacts.
- The test protects an observable contract instead of reproducing private code.
- Logs and reports support every verification statement.
- Device and packaging claims name actual executed targets.
- Missing tools or permissions have concrete next prerequisites.
- Performance conclusions use comparable captures and preserve raw data.
- Product rules and balancing decisions remain grounded in agreed canon.

## Evidence limitations

These workflows are original PlayWeld recommendations informed by official documentation.
The examples are illustrative procedures, not executed engine or connector tests.
A skill file alone provides no engine, platform module, license, templates, or device.
The installed engine and connector determine the operations actually available.
Do not promise editor graph/asset mutations before reading discovered tool schemas.
Do not use fake platform tests as evidence of live engine compatibility.
Do not use headless runs as proof of GPU output or player-visible visual quality.
No benchmark values or performance gains are claimed by this reference.

## Opened primary sources

- [ue bp documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine?application_version=5.6)
- [ue tests documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- [ue run documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine?application_version=5.6)
- [ue build documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine?application_version=5.6)
- [ue profile documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine?application_version=5.6)
