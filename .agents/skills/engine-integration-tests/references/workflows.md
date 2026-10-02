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

## Annotated example: projectile damages the same target twice

Acceptance criterion: one projectile impact removes exactly 10 health once.
Fixture: one shooter, one target with 100 health, no environmental damage.
Set spawn positions and input through supported project test hooks.
Observe target health after the impact resolves; expect 90, not merely an impact callback.
Assert the projectile cannot produce a second damage event after resolution.
Clean up spawned actors/nodes/objects and reset the test state.
First demonstrate failure on the current duplicate-impact implementation.
Apply the smallest authorized fix and run the same fixture again.
Replay a representative real scene to catch fixture-only assumptions.
If only a fake transport is available, report live gameplay verification as unperformed.

### Suggested engine mapping

- Unreal: a focused level Functional Test or project Automation test with world setup.
- Unity: a PlayMode test that yields until the observable impact completes.
- Godot: the existing project harness, or an explicit test scene with assertions and exit.

Keep world simulation enabled when collision is the behavior under test.
A mocked collision callback can cover logic but cannot establish collision integration.
Configure timeout and cleanup before launching a world-dependent fixture.

### Representative evidence record

```text
Fixture: ProjectileDamageOnce
Engine/version: discovered at execution time
Target/configuration: recorded at execution time
Expected: health 100 -> 90 after one resolved impact
Observed: populate only after execution
Artifacts: engine log and runner report, if generated
Unverified: packaged target and multiplayer roles, if not executed
```

This is a report template, not a passing test result.

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

- [ue tests documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- [ue run documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine?application_version=5.6)
- [unity tests documentation](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- [godot cli documentation](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- [godot debug documentation](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/overview_of_debugging_tools.html)
