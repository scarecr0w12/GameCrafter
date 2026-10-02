---
name: test-driven-development
description: "Use red-green-refactor to implement specified game or platform behavior and reproduce bugs with meaningful automated tests. Use when test-first development is requested or a regression needs a failing test at the appropriate logic, engine, or packaged boundary."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Develop behavior through meaningful regression tests

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

## Test-driven development workflow

### Choose a meaningful seam

Read the behavior request and identify the smallest observable contract.
Locate existing tests, test commands, fixtures, and project conventions.
Prefer a pure logic seam when the behavior does not require engine execution.
Use engine tests when lifecycle, resources, physics, or scene wiring causes the failure.
Use connector fakes only for the platform transport/broker behavior they represent.
Do not introduce a framework simply because the skill provides an example.
For reversible prose/content edits, do not add tests that merely mirror the edit.

### Red: demonstrate the missing behavior

Write one focused test with realistic inputs and a player/platform-visible assertion.
Run it against the unchanged relevant behavior and inspect the failure.
Ensure failure is the intended unmet behavior, not syntax, missing imports, or setup.
Preserve the actual failure output as evidence of the regression reproduction.
For a bug, include the minimum conditions that trigger the observed defect.
Avoid snapshot churn and assertions on private details that do not protect behavior.

### Green: implement the smallest coherent fix

Change the owning module using established architecture and interfaces.
Run the narrowest relevant test after each coherent implementation change.
Do not weaken the assertion or suppress errors to obtain a passing result.
Check adjacent acceptance boundaries such as zero, maximum, repeated inputs, and teardown.
Add cases when they protect distinct semantics, not to inflate coverage numbers.
Keep runtime and editor/tooling boundaries explicit.

### Refactor: improve structure with evidence intact

Remove duplication and improve names while preserving the observable contract.
Keep data flow and ownership clear rather than extracting superficial wrappers.
Rerun the relevant test after refactoring.
Run broader required repository checks before reporting completion.
For PlayWeld code follow its strict TypeScript, Vitest, npm, and turbo conventions.
For engine projects use their actual configured runner and compatible engine version.

### Interpret the results honestly

A passing test requires executed assertions, not just runner startup or process exit.
Check skipped/filtered tests and expected counts in runner reports.
Investigate flaky timing with explicit readiness, deterministic inputs, and cleanup.
Do not hide intermittency behind unconditional retries.
Report tests that could not run and the prerequisite that would enable them.
An existing test reproduced after the fix can supplement a new regression test.
Do not describe an engine fake as a live physics, rendering, or device test.

### Completion criteria

The red failure matches the requested behavior or reproduced defect.
The same test passes after the fix and remains meaningful after refactoring.
Required project checks pass or their concrete failures/limitations are reported.
Changed files and the regression protected are understandable to a reviewer.
