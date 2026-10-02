# Level design: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Design a ten-minute ruined outpost with a shortcut back to the entrance.

**Initial investigation:** Map entry, objective, threat, recovery, and shortcut nodes; record movement metrics.

**Proposed action:** Block out both routes and restart at every checkpoint using the real controller.

**Expected handoff:** Editable greybox, route diagram, traversal captures, and an explicit art handoff.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Validate movement metrics in the blockout | Traversal: Route recordings and dimensions. |
| Test encounter routes and retreat | Camera: Screenshots with location and camera settings. |
| Exercise checkpoint state | Recovery: Checkpoint state and completion evidence. |
| Evaluate first-time navigation | First-time route: Wrong turns, missed cues, and corrective design proposals. |

## Detailed scenarios

### 1. Validate movement metrics in the blockout

- Build a metric lane with a narrow doorway, stairs, slope, overhead obstruction, and three candidate jump gaps.

- Record controller capsule dimensions, walk/run speed, jump configuration, and the map units before changing geometry.

- Test approach to each gap from standing, running, and an oblique angle; include the intended input device.

- Inspect snagging at seams and whether the camera clears the same opening as the collision body.

- When traversal fails, separate reachability, collision, input timing, and camera visibility rather than widening everything.

- Save labeled lane dimensions and representative successful/failed traversals for the environment-art handoff.

### 2. Test encounter routes and retreat

- Use an outpost layout with an exposed main gate, elevated side path, objective courtyard, and locked return shortcut.

- Walk both routes with the actual camera and inspect when threats and the objective first become visible.

- Stage one intended encounter; check cover entrances, retreat space, flank visibility, and ability to leave without camera trapping.

- Try an unintended shortcut over low geometry and a repeated safe attack from the edge of enemy reach.

- If an exploit appears, evaluate whether it is a legitimate route choice before closing it with invisible collision.

- Produce a route graph and encounter captures showing approach, engagement, recovery, and exit instead of only a top-down image.

### 3. Exercise checkpoint state

- Create checkpoints before the courtyard encounter and after opening the return shortcut, using hypothetical identifiers CP_A and CP_B.

- Die after consuming a key but before completing the objective; verify the restart cannot leave a permanently locked route.

- Restart after shortcut unlock and inspect key inventory, door state, enemy state, player location, and active objective.

- Load a saved checkpoint after a level transition; check that required spawned objects exist before applying restored state.

- Classify intended respawn resets separately from accidental state loss; document the design rule behind each retained value.

- Keep an initial/restored state table and recording of successful completion from each checkpoint.

### 4. Evaluate first-time navigation

- Ask a participant to reach the antenna using the opening view; avoid mentioning the elevated side path.

- Record first route, repeated backtracking, missed landmark, and any moment they mistake scenery for a traversable surface.

- Inspect visibility at decision points with the participant’s camera settings rather than only the designer’s free camera.

- Propose one cue adjustment, such as silhouette, framing, or local contrast, and preserve optional secrets.

- After art replacement, rerun affected sightlines and collision checks because silhouettes and decorative clutter may alter decisions.

- Deliver before/after captures at named decision points and qualify navigation feedback by the participant sample.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Route graph, metric sheet, and editable blockout.
- Encounter and checkpoint specification with state rules.
- Traversal evidence, observed defects, and art handoff constraints.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- All required routes are reachable using the selected controller.
- Collision and camera tests include narrow and vertical spaces.
- Checkpoint restarts preserve enough state to finish the level.
- Greybox screenshots are labeled as design evidence, not final visual quality.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Prototype environment refinement and testing](https://learn.unity.com/course/creative-core-prototyping).
- [Input and interaction accessibility](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107).
