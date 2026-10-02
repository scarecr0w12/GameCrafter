# Practical workflows and evidence

**Last researched:** 2026-10-01

## Version boundary

Reference baselines: Unreal Engine 5.6, Unity 6.0 (6000.0), Unity Test Framework 1.4, and Godot 4.4.
These are documentation editions, not a latest-version claim or a tested support matrix.
Recheck installed-version documentation and executable help before using commands.

## Annotated example: moved enemy scene cannot find its health bar

Request: audit Enemy.tscn after it moved into a reusable encounter scene.
Inspect the enemy script, its inherited scenes, and the failing NodePath.
The old ../../HUD/HealthBar path assumes one particular parent layout.
Confirm the runtime error and exact failing call before suggesting a repair.
Recommend an exported dependency or a signal handled by the parent context.
If fixes are authorized, update only the intended script/scene references.
Import the project and run the enemy in two distinct parent scenes.
Verify the health display updates and that the second parent needs no hidden path.
The independent-parent check validates reusability rather than only the original layout.

### Illustrative checks

```text
<godot-editor> --headless --path <project> --import
<godot-editor> --headless --path <project> --script <script> --check-only
<godot-editor> --path <project> <scene.tscn>
```

Verify flags against the installed binary's --help output.
The import is an editor/resource check, and check-only covers its selected script.
The scene run must observe the affected behavior; launch alone is insufficient.
Use a bounded timeout and supported process cancellation for a hanging scene.
Do not claim visual correctness from the headless checks.

### Export follow-through

```text
<godot-editor> --headless --path <project> --export-debug <preset> <output-file>
```

Use an existing named preset and matching installed export templates.
Inspect export errors, then launch the artifact to verify runtime-loaded assets.

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

- [godot cli documentation](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- [godot scene documentation](https://docs.godotengine.org/en/4.4/tutorials/best_practices/scene_organization.html)
- [godot debug documentation](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/overview_of_debugging_tools.html)
- [godot export documentation](https://docs.godotengine.org/en/4.4/tutorials/export/exporting_projects.html)
- [godot profile documentation](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/the_profiler.html)
- [godot vcs documentation](https://docs.godotengine.org/en/4.4/tutorials/best_practices/version_control_systems.html)
