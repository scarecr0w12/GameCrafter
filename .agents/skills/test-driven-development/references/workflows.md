# Practical workflows and evidence

**Last researched:** 2026-10-01

## Version boundary

Reference baselines: Unreal Engine 5.6, Unity 6.0 (6000.0), Unity Test Framework 1.4, and Godot 4.4.
These are documentation editions, not a latest-version claim or a tested support matrix.
Recheck installed-version documentation and executable help before using commands.

## Annotated example: negative damage heals a target

Contract: damage cannot increase health; the project's rule rejects negative amounts.
Existing behavior subtracts an unchecked amount from health.
Write a test that starts at 50 health and applies -10 using the public damage API.
Assert the agreed rejected outcome and unchanged health, using existing error conventions.
Run before the fix; confirm the test fails because health becomes 60.
Add input validation at the rule owner, not in a caller-specific UI filter.
Run the same test again and then relevant positive/zero/lethal-damage cases.
Refactor repeated validation only if it simplifies the owning interface.
Record actual red and green output paths in the handoff.

### Selecting the boundary

A pure damage calculation can use the project's ordinary unit runner.
If the defect occurs through duplicate collision callbacks, use an engine integration test.
If it occurs only after loading a save, exercise the actual persistence boundary.
Choose the boundary from the failure, not from whichever runner starts fastest.

### Anti-example and correction

Weak test: verify the new guard function is called once.
Useful test: negative damage leaves health unchanged through the public behavior.
Weak evidence: test file exists and its assertion looks plausible.
Useful evidence: a relevant red failure and the same assertion passing after the fix.

### Failure record template

```text
Behavior: negative damage cannot increase health
Red: populate command, relevant assertion failure, and log only after running
Green: populate the same test's result only after running
Refactor: list structural changes and final check result
Boundary: pure logic, engine, packaged artifact, or target device
```

No engine, runner, or result is presumed available in this example.

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

These workflows are original GameCrafter recommendations informed by official documentation.
The examples are illustrative procedures, not executed engine or connector tests.
A skill file alone provides no engine, platform module, license, templates, or device.
The installed engine and connector determine the operations actually available.
Do not promise editor graph/asset mutations before reading discovered tool schemas.
Do not use fake platform tests as evidence of live engine compatibility.
Do not use headless runs as proof of GPU output or player-visible visual quality.
No benchmark values or performance gains are claimed by this reference.

## Opened primary sources

- [ue tests documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- [ue run documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine?application_version=5.6)
- [unity tests documentation](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- [godot cli documentation](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
