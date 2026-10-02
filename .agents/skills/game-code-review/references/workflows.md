# Game code review matrix

Source review: 2026-10-01. The matrix and examples are original GameCrafter
recommendations. Engine references document specific integration/testing facilities.

## Evidence-ranked finding

```text
Title: Respawn retains the previous camera target after player replacement
Trigger: die twice after changing levels
Path: respawn creates a new player but the camera subscribes only on initial load
Wrong result: view follows the destroyed instance and stops moving
Expected: camera follows the active player after every respawn
Evidence: minimal scene, two-death recording, subscription call site
Fix: replace target on spawn and detach the old lifecycle subscription
Regression: initial spawn, repeat death, level transition, cancelled spawn
```

This example is fictional. It illustrates the structure of a useful finding and
must not be reported as a defect found in the current project.

## Failure-mode checklist

| Area        | Concrete checks                                                         |
| ----------- | ----------------------------------------------------------------------- |
| Input       | key repeat, focus loss, remap, controller disconnect, UI capture        |
| Simulation  | duplicate events, invalid transition, paused time, deterministic seed   |
| Physics     | layers, trigger exit, fast motion, moving bodies, spawn overlaps        |
| Navigation  | unreachable destination, moving target, interrupted path, agent removal |
| Lifecycle   | spawn/despawn, pooling reset, scene unload, deferred callbacks          |
| Saves       | older schema, missing asset ID, interrupted write, corrupt record       |
| Assets      | identity, import settings, runtime references, missing export files     |
| Async       | cancellation, duplicate completion, timeout, stale task result          |
| Multiplayer | authority, validation, late join, reconnect, simultaneous requests      |
| Rendering   | camera distance, transparency, bounds, unsupported material feature     |
| Audio       | overlaps, loops, restart, bus routing, clipping, unload                 |
| Release     | packaged paths, case sensitivity, clean-machine startup                 |

## Example: asset identity regression

A Unity change that moves only an asset file can detach the corresponding .meta
identity. Inspect GUID references and the accompanying .meta movement before
claiming the content survived the rename. Unity describes the identity mechanism
and the impact of missing metadata. [Unity 6.0 asset metadata](https://docs.unity3d.com/6000.0/Documentation/Manual/AssetMetadata.html).

A focused test can open a copied scene/prefab and check the affected references;
source-file existence alone does not establish a valid import.

## Example: misleading engine test success

A process can exit cleanly after importing resources while never starting gameplay.
Inspect the invoked mode and resulting test report. Godot documents import,
script-check, run, and export operations independently.
[Godot 4.4 CLI](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html).

Unreal's automation guidance requires tests to establish their own state and clean
created disk state. Re-running a test in a preconfigured editor can hide broken setup.
[Unreal 5.6 automation](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6).

## Severity and confidence

A corrupt-save defect with a normal reproducible trigger deserves attention before
an optional architectural cleanup. A network authority issue needs a demonstrated
untrusted input path and affected action, rather than an assumption about all RPCs.
A performance concern needs a relevant workload and measurement when claiming a gain.
A rendering regression needs a representative view or repeatable render comparison.

State confidence explicitly when evidence is partial:

- Reproduced: an observed failure with a retained fixture or command.
- Source supported: a concrete reachable path; runtime check remains unavailable.
- Needs investigation: a plausible hypothesis with unresolved conditions.

Keep speculative items separate from confirmed defects. Review coverage notes should
name the areas and checks inspected, with gaps rather than a universal clean bill.

## Review handoff

Deliver the finding list and fixes together with executable commands, reports,
fixtures, build configuration, engine version, and artifacts. If a finding was fixed,
explain how the regression test distinguishes the old behavior from the corrected one.
