---
name: narrative-style-guide
description: "Create or revise game narrative canon, character voice, quests, dialogue, lore, and branching story content. Use when writing narrative records or keeping new story material consistent; deliver editable prose and state-aware narrative checks."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Narrative style guide

Preserve the user’s story intent while producing coherent, playable narrative with explicit state and voice rules.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Approved canon, timeline, character motivations, and spoiler boundaries.
- Existing dialogue, quest states, presentation limits, and localization needs.
- Target narrative runtime and version, or an engine-neutral requested output.

## Procedure

### 1. Establish canon authority

- Read approved canon and distinguish drafts, rumors, and unreliable narration.
- Record unresolved contradictions without resolving creative choices silently.

### 2. Define voice rules

- Give each speaker vocabulary, sentence rhythm, social posture, and forbidden habits.
- Use short original examples for ordinary, pressured, and evasive speech.

### 3. Outline player intent

- Identify why the player enters the scene and what choices they can make.
- Make stakes and consequences legible without exposing intended secrets.

### 4. Model quest and dialogue state

- List prerequisites, transitions, outcomes, and persistent variables.
- Distinguish narrative fact, player knowledge, and character belief.

### 5. Write branches with reconvergence

- Keep branches meaningful through information, relationship, cost, or action.
- Plan joins and endings so the content does not multiply without purpose.

### 6. Connect gameplay consequences

- Associate dialogue choices with explicit state changes or presentation-only effects.
- Specify what happens if the player interrupts, returns later, or changes quest order.

### 7. Prepare editable source

- Use the project’s narrative format and stable line identifiers where supported.
- Keep speaker/context/placeholder notes alongside translation handoff content.

### 8. Compile or validate

- Use the installed runtime’s supported validation and record version/output.
- If only reviewing text, state that runtime compilation and branch execution remain unverified.

### 9. Exercise state combinations

- Test first visit, revisit, alternate prerequisites, and every intended ending.
- Inspect unreachable content, repeated rewards, missing exits, and impossible knowledge.

### 10. Deliver canon changes

- Provide changed records, reason, dependencies, and spoiler-aware summary.
- Route substantive canon decisions back to the user when no existing intent settles them.

## Deliverables

- Voice and canon rules with original examples.
- Editable narrative source and quest/dialogue state map.
- Branch transcripts, validation output, and unresolved contradictions.

## Completion review

- Characters do not know facts unavailable in the tested state.
- All intended branches rejoin or terminate explicitly.
- Interrupt/revisit behavior does not duplicate rewards.
- Localization handoff preserves variables, context, and line ownership.

## Gotchas

- A graph proves connectivity, not emotional impact.
- Localization and performance direction can change voice and pacing.
- Do not adopt a narrative runtime merely because a source example uses it.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that GameCrafter has executed them.
Last researched: 2026-10-01.

- [Branching, joining, conditions, and endings](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).
