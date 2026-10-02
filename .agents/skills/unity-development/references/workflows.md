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

## Annotated example: interaction fires twice after scene reload

Request: opening an inventory emits one interaction event after reloading a scene.
Inspect the owning MonoBehaviour and subscription lifecycle before editing.
Hypothesis: the object subscribes in OnEnable but never unsubscribes in OnDisable.
Add the matching teardown using the existing project's event ownership rules.
Preserve component serialization and the existing .meta file.
Add a PlayMode regression that enables, disables, reloads, and triggers the event.
Assert one observable inventory action; do not only assert a handler count in code.
Run the focused test and inspect its XML results and Editor log.
Replay the same interaction in the actual scene with the available engine connection.
Record that editor behavior is verified separately from a packaged player.

### Illustrative test invocation

```text
<unity-editor> -batchmode -projectPath <project> -runTests
  -testPlatform PlayMode -testFilter <existing-or-added-test>
  -testResults <artifact-directory>/results.xml -logFile <artifact-directory>/editor.log
```

Join the arguments into an argument array or correctly quoted command.
Resolve placeholders from discovered project tooling, not a guessed installation.
Check the installed Test Framework documentation before adding optional flags.
Do not start this batch run while the same project is open in another Unity editor.
Do not claim the XML exists until it has been written and inspected.

### Build follow-through

Use the project's existing Editor-only build entrypoint when available.
Inspect the returned BuildReport and explicitly return failure for failed/canceled builds.
Launch the built player and repeat the scene reload interaction if packaging is in scope.

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

- [unity cli documentation](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- [unity tests documentation](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- [unity meta documentation](https://docs.unity3d.com/6000.0/Documentation/Manual/AssetMetadata.html)
- [unity build documentation](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/BuildPipeline.BuildPlayer.html)
- [unity profile documentation](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html)
