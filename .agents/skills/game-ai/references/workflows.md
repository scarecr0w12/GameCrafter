# Game ai: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** A guard chases indefinitely after losing the player.

**Initial investigation:** Inspect perception/memory boundaries and the transition log.

**Proposed action:** Add explicit lost-target search and return states, then reproduce wall/door cases.

**Expected handoff:** Controller changes, transition traces, scenario recordings, and remaining perception limits.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Test perception and memory fairly | Perception: Fact/intent trace and player-view recording. |
| Recover from unreachable navigation | Path failure: Recovery state and no permanent stuck condition. |
| Exercise action cancellation and scoring | Interruption: Cancellation and ownership cleanup. |
| Measure NPC workload and player experience | Load: Timing capture with build/settings; no extrapolated scaling claim. |

## Detailed scenarios

### 1. Test perception and memory fairly

- Create a patrol fixture with one wall, one open sightline, a player hiding point, and a noise source.

- Record the intended sight range, field of view, hearing rule, and memory timeout as proposed tuning values.

- Move from visible to occluded space and compare perceived facts, remembered position, chosen intent, and visible animation.

- If pursuit continues, determine whether perception still reports visibility or whether memory expires incorrectly.

- Test a noise outside sight and a decoy noise; verify decisions use the intended source rather than the true player location.

- Preserve debug traces and player-view footage separately so fair information use and readable behavior can both be assessed.

### 2. Recover from unreachable navigation

- Place a target behind a closed door and another on a ledge outside the NPC’s movement capability.

- Observe path request, path result, actual velocity, and elapsed time without inventing engine-specific API names.

- Close the door after pursuit begins to distinguish initial no-path handling from mid-action route invalidation.

- Define a bounded retry, alternate goal, search, or return behavior according to NPC purpose; endless retries are not useful recovery.

- Inspect whether the NPC keeps attacking through the wall after movement fails and whether animation agrees with its intent.

- Deliver stuck-state reproduction and a trace showing the recovery transition rather than only a navigation-mesh screenshot.

### 3. Exercise action cancellation and scoring

- Use attack, flee, and investigate actions with explicit prerequisites and interruption rules in a small test room.

- Remove the target during an attack, stun the NPC during windup, and destroy the NPC while a callback is pending.

- Check that target references, movement requests, effects, and reservations are released at the selected lifecycle boundary.

- For score-based choice, vary two competing scores around the selection threshold and inspect rapid action oscillation.

- Use a proposed commitment period or hysteresis only when it improves the desired behavior; record its responsiveness tradeoff.

- Save transition reasons, selected scores if used, cancellation traces, and evidence no action stays permanently active.

### 4. Measure NPC workload and player experience

- Run representative fixtures with 1, 10, and 30 NPCs only if those counts match the game’s intended population.

- Keep spawn layout, seed, movement, perception, and target hardware fixed while collecting controller/navigation timings.

- Inspect clustered NPCs and simultaneous target changes because a uniform idle crowd may miss the expensive workload.

- If update frequency is reduced, test reaction delay, fairness, and readable anticipation alongside CPU cost.

- Compare repeated seeded traces for regression, but allow deliberate variation when the design requires nondeterminism.

- Report measured configurations and behavior tradeoffs; do not extrapolate maximum population from one capture.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Behavior contract, controller/state diagram, and action definitions.
- Editable tuning data and optional debug view.
- Scenario captures, known failures, and measured cost when available.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Every action can complete, fail, or cancel without trapping the controller.
- NPC decisions use only intended perception or memory facts.
- Path failure and target loss lead to defined recovery.
- Scaling claims include NPC count, hardware, build, and recorded workload.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Dependency and lifecycle principles; not an AI algorithm authority](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html).
- [Measured performance capture](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
