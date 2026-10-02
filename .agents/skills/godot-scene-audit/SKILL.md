---
name: godot-scene-audit
description: "Audit Godot scene trees, scripts, resources, node paths, signals, and export readiness after refactors or before export. Use for missing scripts, broken scene dependencies, runtime path failures, or Godot headless validation."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
  gamecrafter-engines: godot
---

# Audit Godot scenes and their runtime dependencies

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

## Godot scene audit workflow

### Inventory the scene boundary

Read project.godot and inspect the installed editor version and renderer.
Identify the main scene, autoloads, relevant .tscn/.tres resources, and language.
Discover whether the binary supports C# and whether native extensions are involved.
Record export presets and available templates without exposing stored credentials.
Use version-specific documentation; Godot 3 and 4 syntax are not interchangeable.

### Inspect structure and references

Trace external resources and scripts from the requested scene set.
Check node paths, owner relationships, inherited scenes, and overridden properties.
Inspect signal connections for missing methods or duplicate runtime registration.
Check required nodes and exported references at initialization time.
Evaluate reusable scenes independently of their original parent hierarchy.
Prefer parent-supplied dependencies and signals where the existing design permits.
Mark unused-looking resources as candidates; do not delete on reachability guesses alone.
Account for dynamically loaded resources, autoloads, and export inclusion rules.
Keep resource identity and tracked source metadata intact during refactors.

### Run appropriate checks

Use the installed binary's help to verify available flags and build-type support.
Import the project with an editor binary to expose actual resource import failures.
Use script parsing checks only for the scripts actually submitted to the check.
Do not describe a single-script check as full-project validation.
Run the requested scene to observe initialization and gameplay references.
Use runtime collision/navigation visualization when these are relevant to a failure.
Inspect the remote tree/runtime state if a discovered connector supports it.
For C# timing, discover a supported external profiler; Godot 4.4's profiler excludes C#.

### Audit export readiness

Check the named preset, output directory, editor binary, and matching templates.
Keep export-debug and export-release evidence separate.
Launch the exported artifact when requested and supported on this host/device.
Confirm runtime-loaded resources appear in the export.
Do not equate headless execution with visual rendering correctness.
Treat 3.x/4.0 export credential handling separately from 4.1+ VCS defaults.

### Findings and completion

Report each issue with scene/resource path, reproduction, severity, and evidence level.
Distinguish confirmed missing resources from speculative design cleanup.
Describe a safe focused repair and its validation for each confirmed defect.
Apply repairs only when the request authorizes them; an audit can remain read-only.
List scenes and platforms that were not executed or exported.
