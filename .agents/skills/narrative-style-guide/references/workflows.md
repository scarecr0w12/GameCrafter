# Narrative style guide: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Write a guard conversation that changes after the bridge is repaired.

**Initial investigation:** Separate bridge world state from the guard’s knowledge and the player’s prior dialogue.

**Proposed action:** Write initial, repaired, and revisit branches with one explicit reward transition.

**Expected handoff:** Source, state graph, voice examples, and transcripts for each entry condition.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Separate world state and character knowledge | First visit: Transcript with initial state. |
| Validate branching and reconvergence | Alternate knowledge: Transcript showing consistent world and speaker knowledge. |
| Prevent duplicated rewards and interrupted scenes | Repeat visit: State changes proving reward is not repeated. |
| Review voice and translation handoff | Ending and localization: Compilation or review result plus line inventory. |

## Detailed scenarios

### 1. Separate world state and character knowledge

- Use a hypothetical bridge quest with bridge_repaired, guard_informed, and player_met_guard as distinct narrative facts.

- Write the first meeting when the bridge is broken, then the first meeting when the player repaired it without informing the guard.

- Identify every line that implies knowledge; connect that implication to an actual prerequisite rather than a convenient global flag.

- Test the guard after another character delivers the news and ensure voice changes follow the intended relationship.

- If state is missing, propose a new knowledge variable or rewrite the line; do not silently grant omniscience.

- Keep entry-state tables and branch transcripts with explicit speaker beliefs and player knowledge.

### 2. Validate branching and reconvergence

- Draft three choices: ask for help, threaten the guard, and leave; assign information, relationship, or access consequences.

- Draw the joins and explicit exits before writing optional flavor so the branch count stays deliberate.

- Follow every branch with conditions both true and false; identify choices that disappear leaving no reachable exit.

- Try a loop back to the introduction and inspect whether new information changes repeated dialogue meaningfully.

- Compile with the selected runtime if available; classify syntax failures separately from logically unreachable content.

- Save a branch map with tested paths and transcripts rather than claiming all possible combinations from one successful playthrough.

### 3. Prevent duplicated rewards and interrupted scenes

- Place the repair reward behind an explicit not-yet-awarded prerequisite and name the state transition that commits it.

- Leave the conversation just before confirmation, re-enter, and inspect whether rewards or prerequisite consumption already occurred.

- Reload after confirmation and select the same option again; inspect inventory and the persistent awarded state together.

- Test quest completion through an alternate route before meeting the guard; specify whether the same reward remains available.

- Choose the intended transaction boundary before fixing the script so skipping a cutscene does not destroy the earned reward.

- Deliver a before/after flag-and-inventory table, interruption transcript, and any pending runtime persistence verification.

### 4. Review voice and translation handoff

- Write short guard lines for ordinary conversation, urgent danger, and evasive refusal using the approved voice rules.

- Compare word choice and sentence rhythm with canon examples; explain deviations required by the scene’s emotional state.

- Attach line identifiers, speaker, context, variable meanings, and caption length concerns to the export.

- Check whether jokes or idioms are essential meaning or replaceable tone; give translators intent instead of literal alternatives only.

- Inspect placeholders such as player name in alternate sentence orders; do not invent runtime plural support.

- Keep human voice/translation review pending when only automated checks or agent editorial review were performed.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Voice and canon rules with original examples.
- Editable narrative source and quest/dialogue state map.
- Branch transcripts, validation output, and unresolved contradictions.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Characters do not know facts unavailable in the tested state.
- All intended branches rejoin or terminate explicitly.
- Interrupt/revisit behavior does not duplicate rewards.
- Localization handoff preserves variables, context, and line ownership.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Branching, joining, conditions, and endings](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).
