---
name: game-ai
description: "Design, implement, or debug in-game NPC behavior, navigation, perception, tactical choices, utility scoring, behavior trees, or state machines. Use for gameplay AI behavior and testing; separate this from GameCrafter authoring agents or model routing."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game ai

Build observable, controllable NPC behavior that serves the intended player experience.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- NPC purpose, player-facing tells, allowed actions, and difficulty intent.
- Movement/navigation constraints, perception rules, and ownership of world state.
- Existing controller, test map, engine/version, and CPU budget.

## Procedure

### 1. Describe behavior from the player view

- Write examples of what the NPC notices, does, and communicates.
- Specify fair warning, reaction timing, and intended weaknesses before selecting an architecture.

### 2. Choose a minimal controller

- Use a state machine for a small explicit state set, or another structure when its benefits are concrete.
- Treat architecture selection as an original recommendation requiring project evidence.

### 3. Separate facts and decisions

- Model perception, remembered information, chosen intent, and actuator results distinctly.
- Record what information is available to each NPC; avoid hidden omniscience unless intended.

### 4. Define action contracts

- Name preconditions, completion, cancellation, cooldown, and failure for each action.
- Give blocked navigation and unavailable targets explicit recovery behavior.

### 5. Author readable transitions

- Make priorities and interruption rules visible to designers.
- Prevent rapid oscillation with explicit commitment rules or score hysteresis where appropriate.

### 6. Connect navigation

- Test target selection and actual movement together in representative geometry.
- Handle lost paths, unreachable goals, moving obstacles, and invalidated destinations.

### 7. Add observation controls

- Expose current state, intent, target, perception facts, and last transition reason.
- Make debug display optional and avoid leaking it into production player UI.

### 8. Build repeatable situations

- Use seeded randomness where possible and control spawn/target conditions.
- Test changes with recorded inputs and distinguish deterministic assertions from emergent behavior.

### 9. Measure behavior and cost

- Check player fairness, tactical variation, stuck rates, and computation time separately.
- Profile multiple NPCs on target hardware before claiming the behavior scales.

### 10. Deliver tuning and limits

- Provide parameters, defaults, designer explanations, and scenario results.
- Label these controller recommendations as project judgments rather than universal engine best practices.

## Deliverables

- Behavior contract, controller/state diagram, and action definitions.
- Editable tuning data and optional debug view.
- Scenario captures, known failures, and measured cost when available.

## Completion review

- Every action can complete, fail, or cancel without trapping the controller.
- NPC decisions use only intended perception or memory facts.
- Path failure and target loss lead to defined recovery.
- Scaling claims include NPC count, hardware, build, and recorded workload.

## Gotchas

- A navigation path exists without guaranteeing believable pursuit.
- Randomness can conceal a bug unless seeds and inputs are recorded.
- An LLM NPC proposal needs separate latency, cost, privacy, and failure analysis.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that GameCrafter has executed them.
Last researched: 2026-10-01.

- [Dependency and lifecycle principles; not an AI algorithm authority](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html).
- [Measured performance capture](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
