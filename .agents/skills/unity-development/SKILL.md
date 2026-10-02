---
name: unity-development
description: "Implement, debug, profile, and build Unity C# gameplay, scenes, prefabs, or editor tooling. Use for Unity compile failures, runtime bugs, asset reference problems, tests, and target-device performance work."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
  gamecrafter-engines: unity
---

# Develop and validate Unity projects

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

## Unity workflow

### Establish version and ownership

Inspect ProjectSettings/ProjectVersion.txt and the actual editor executable version.
Read Packages/manifest.json, package lock, assembly definitions, and renderer settings.
Identify runtime assemblies versus Editor-only code and platform defines.
Find the scene, prefab, component, ScriptableObject, or service owning the behavior.
Record whether the same project is already open in Unity before batch execution.

### Implement C# and content changes

Preserve the existing component lifecycle, dependency setup, and serialization conventions.
Review Awake/OnEnable/Start ordering and teardown when investigating initialization bugs.
Check duplicate subscriptions, disabled objects, missing references, and scene reload behavior.
Keep asset .meta files with their assets when moving or renaming files.
Use available editor APIs/connectors for prefab and scene changes.
Do not replace asset identity to fix a missing reference without investigating the cause.
Inspect prefab overrides and script field migrations after serialized API changes.
Compile through Unity; an external C# compiler may not reflect Unity defines/packages.

### Automate safely within the current project session

Use explicit project paths, log paths, target, and configuration.
Use batch mode for noninteractive CLI work when the project session permits it.
Use a static Editor-only entrypoint for executeMethod workflows.
Avoid a concurrent batch editor against the same open project.
Read the full Editor log; console output may omit useful details.
Check BuildReport.summary.result and propagate failure from custom build entrypoints.
Preserve the selected build profile or project build script.

### Validate behavior and performance

Choose EditMode tests for appropriate non-frame logic and PlayMode for lifecycle/gameplay.
Use the installed Test Framework version's supported filters and platform arguments.
Retain result XML and inspect failed tests and stack traces.
Do not use synchronous EditMode execution to replace multi-frame tests.
Replay the original scene interaction, including disable/re-enable and scene reload cases.
For performance work, capture a representative player on the intended target.
Record workload, device, build options, profiler settings, and comparable measurements.
Keep Editor observations distinct from Player/device observations.

### Completion criteria

Unity imports and compiles the affected source/assets without new relevant errors.
Changed prefab/scene references retain their intended identities.
Tests and actual runtime interactions satisfy the recorded acceptance criteria.
A requested build includes the intended scenes and has an inspected successful report.
Unsupported platform modules, licenses, or device checks are named explicitly.
