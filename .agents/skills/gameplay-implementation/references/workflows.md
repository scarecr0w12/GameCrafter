# Practical workflows and evidence

**Last researched:** 2026-10-01

## Version boundary

Reference baselines: Unreal Engine 5.6, Unity 6.0 (6000.0), Unity Test Framework 1.4, and Godot 4.4.
These are documentation editions, not a latest-version claim or a tested support matrix.
Recheck installed-version documentation and executable help before using commands.

## Annotated example: stamina-gated dodge

Agreed rules: dodge costs 20 stamina, needs at least 20, and cannot overlap itself.
Inspect the existing input action, player movement owner, stamina model, and animation hook.
Represent eligibility in the gameplay rule owner, not in a UI button or animation callback.
On accepted input, debit stamina once and enter dodging using the project's timing model.
On rejected input, keep stamina and movement state unchanged.
Use the specified completion/cancellation rules to leave dodging.
Do not add invulnerability, cooldown balance, or networking semantics unless specified.

### Behavior checks

- Start at 19: input rejects and stamina remains 19.
- Start at 20: input accepts and stamina becomes 0.
- Start at 40: repeated input during an active dodge does not double debit.
- Finish the dodge: the next valid input follows the existing recovery rule.
- Reload or disable the player: no stale input subscription survives.

Use a pure rule test for eligibility and an engine check for actual movement/lifecycle.
Verify visual feedback corresponds to accepted and rejected actions as designed.
Run the mechanic in a representative level with the intended input binding.
Record packaged/device checks separately if they were requested and executed.

### Handoff example

```text
Rule owner: identify the existing player movement or ability module
Content: identify any affected prefab/Blueprint/scene and serialized defaults
Evidence: list actual rule tests and actual runtime observations
Tuning: reference the existing stamina-cost parameter location
Limit: explicitly name unavailable engine or device verification
```

This example describes a proposed fixture; it claims no executed gameplay result.

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

- [ue bp documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine?application_version=5.6)
- [godot scene documentation](https://docs.godotengine.org/en/4.4/tutorials/best_practices/scene_organization.html)
- [unity meta documentation](https://docs.unity3d.com/6000.0/Documentation/Manual/AssetMetadata.html)
- [ue tests documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- [unity tests documentation](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
