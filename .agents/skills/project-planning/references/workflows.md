# Project planning: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Plan implementation of a checkpoint system.

**Initial investigation:** Inspect current save and level-transition contracts.

**Proposed action:** Split state capture, restore, failure recovery, and runtime verification by dependency.

**Expected handoff:** Task proposal with artifacts, edge cases, and required packaged-game evidence.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Turn a feature into reviewable tasks | Scope: No unrelated work or missing required behavior. |
| Map dependencies and file ownership | Dependency: Upstream artifacts and ready conditions named. |
| Plan around uncertain external capability | Acceptance: Concrete behavior/artifact and evidence level. |
| Reconcile progress with acceptance evidence | State: No duplicate or invented assignment/completion claim. |

## Detailed scenarios

### 1. Turn a feature into reviewable tasks

- Use checkpoint restoration as the outcome: after death, the player resumes from a defined state without losing required keys.

- Inspect existing save, scene lifecycle, and objective contracts before proposing new interfaces.

- Split into state contract, capture/restore behavior, checkpoint authoring, and runtime failure/recovery verification.

- Give each task an artifact and acceptance case, such as restoring a consumed-key door without a soft lock.

- Exclude unrelated inventory redesign unless inspection shows it is necessary to meet the checkpoint outcome.

- Deliver task proposals that identify confirmed rules and proposed restoration defaults.

### 2. Map dependencies and file ownership

- Create a dependency edge from the checkpoint state schema to restore logic and from authored checkpoint data to runtime tests.

- Identify files likely to conflict, such as a shared save schema, while allowing separate level fixtures to proceed independently.

- If the platform supports claims/locks, inspect their actual contract before assigning or acquiring them.

- If no lock mechanism is available, propose scoped file ownership and a merge/review order rather than inventing a lock API.

- Name the ready condition using an artifact or merged interface, not merely another task being marked in progress.

- Keep repository dependency ordering in DEVELOPMENT_PLAN when authorized; do not add product phases to design documents.

### 3. Plan around uncertain external capability

- For a proposed engine connector, identify the exact capability needed: inspect scene state, mutate assets, or run a packaged test.

- Read supported tool contracts and existing live evidence before assigning implementation to a role.

- Choose a small capability probe with a saved invocation/result when availability is uncertain.

- Let engine-neutral schema or test-fixture work proceed only if it does not depend on an unverified behavior.

- Record fallback and cost when the tool is missing, including whether a manual artifact can still make the result reviewable.

- Deliver a capability/evidence table that distinguishes documented, fake-tested, and live-verified prerequisites.

### 4. Reconcile progress with acceptance evidence

- Compare completed task claims with their actual revision, fixture, logs, and review artifacts.

- If restoration was tested only through mocks, retain that evidence while leaving engine lifecycle verification open.

- Check whether a late user correction changes acceptance, such as preserving unlocked shortcuts after death.

- Update affected task proposals and dependencies without reopening already sufficient unrelated work.

- Use authorized service operations for durable task status; a Markdown plan is not proof of assigned platform tasks.

- Identify next ready work and genuine unresolved creative decisions with concrete recommendations.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Outcome statement and scoped task records.
- Dependencies, ownership recommendations, and acceptance evidence.
- Decision/assumption record and next ready work.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Each task has a result someone can inspect.
- Dependencies refer to actual artifact/task identifiers when available.
- Evidence requirements distinguish fake tests, live tools, and human judgment.
- Existing tasks and accepted user decisions are preserved.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Prototype choice reduces uncertainty; planning workflow is an original recommendation](https://learn.unity.com/course/creative-core-prototyping).
