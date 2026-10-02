---
name: game-code-review
description: 'Review gameplay, engine, tooling, and game-service changes for concrete correctness, lifecycle, persistence, performance, authority, and integration defects. Use before integrating game code or when reviewing an existing mechanic; produce reproducible findings with evidence and targeted fixes.'
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game code review

Review observable failure modes against the intended behavior and actual engine
version. This is an original GameCrafter review procedure. Read the focused matrix
and examples in [review workflows](references/workflows.md).

## Establish the contract

Read repository instructions, relevant design, task acceptance criteria, and tests.
Identify the changed code and direct callers; preserve unrelated working-tree changes.
Record the engine, language, runtime/editor boundary, target, and integration state.
When reviewing a whole system, scope by architectural area and track what was inspected.
Do not imply exhaustive coverage from a few searched files.

Trace one complete behavior from input to state change to presentation and persistence.
Read actual call sites before labeling an unusual abstraction broken.
Distinguish a missing implementation from an intentional unsupported feature.
Check whether an existing test proves the claimed behavior or merely duplicates code.

## Review ownership and lifecycle

Identify who creates, updates, cancels, destroys, and restores each resource.
Inspect duplicate event subscriptions, delayed callbacks after destruction, stale object
references, scene/world transitions, pooled-object reset, and async cancellation.
Check that setup/teardown can repeat without leaking or depending on execution order.
Inspect shutdown behavior and failure cleanup for engine/DCC integrations.
A dispose method helps only if the relevant lifecycle actually calls it.

## Review gameplay rules

Follow state transitions and invariants, including invalid and competing events.
Exercise boundary values, zero durations, input repeats, pause/resume, and low frame rates.
Check time units, fixed versus variable timestep, coordinate spaces, and camera-relative input.
Separate authoritative state from animation/UI representations.
Verify collision layers, trigger ordering, navigation failures, and interruption behavior.
Treat save identifiers and content references as contracts that survive authoring changes.

## Review persistence and services

Check schema/version handling, missing content, interrupted writes, and incompatible saves.
Verify migration behavior using an older fixture where compatibility is claimed.
Inspect authorization at the point of action and server authority for shared state.
Bound external inputs and expensive operations; validate caller-controlled identifiers.
Keep secrets and private player data out of logs and public artifacts.
Use security-review for trust-boundary analysis rather than inventing vulnerabilities
from suspicious syntax alone.

## Review performance and presentation

Look for concrete repeated work, allocations, blocking calls, and avoidable asset loads.
Describe the workload under which a concern matters and collect a profile when available.
Avoid demanding optimizations unsupported by measurement or target constraints.
Inspect visual/audio state after repeated creation, interruption, pooling, and unloading.
Check fallbacks for missing assets and supported accessibility/localization settings.

## Validate findings

For each candidate, establish trigger → code path → wrong result → expected result.
Build the smallest useful reproduction or focused test.
Prefer a regression test that fails before the fix and passes after it.
If live execution is unavailable, identify the source evidence and remaining runtime check.
Do not count an unavailable engine test as passed.

Rank by player/system impact, likelihood, and confidence.
Separate demonstrated defects from design suggestions and optional cleanup.
Give locations and enough context for a reviewer to reproduce the issue.
Do not inflate severity because a change affects many files.

## Fix and hand off

When fixes are authorized, correct the cause and test the affected neighboring behavior.
Keep changes focused enough for another contributor to assess.
Report behavior changed, reproduction, tests run, results, and remaining risks.
For an unresolved finding, explain the missing evidence or prerequisite precisely.
A clean diff, successful compilation, and a pretty screenshot prove different things.
