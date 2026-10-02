---
name: level-design
description: "Design or revise playable level layouts, blockouts, encounter flow, traversal, checkpoints, and spatial onboarding. Use when a task concerns player routes or level gameplay; distinguish greybox validation from environment-art completion."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Level design

Create an editable spatial design that can be traversed and evaluated using the game’s actual mechanics.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Movement, camera, collision, interaction, and combat metrics.
- Level purpose, expected duration, objective sequence, and player entry state.
- Engine/version, existing map boundaries, art direction, and performance constraints.

## Procedure

### 1. Establish player metrics

- Measure speed, jump reach, turn space, sight height, and interaction reach.
- Record units and test conditions; use proposed values only when no playable controller exists.

### 2. Write the level contract

- Name the skill taught or tested and the intended tension curve.
- Define entry/exit, completion condition, failure recovery, and optional discovery.

### 3. Sketch connected routes

- Draw a graph of spaces and routes before decorating rooms.
- Mark gates, loops, alternate paths, shortcuts, and vertical connections.

### 4. Place readable goals

- Choose landmarks and sightlines that communicate destinations.
- Support essential information through more than a fixed color cue.

### 5. Build a metric blockout

- Use editable primitives with consistent dimensions and collision.
- Label temporary materials and keep test geometry separate from final art assets.

### 6. Compose encounters

- Place hazards, cover, enemies, tools, and safe spaces around player decisions.
- Inspect approach, engagement, retreat, reward, and recovery as one sequence.

### 7. Test traversal and camera

- Run the actual movement/camera setup through all intended routes.
- Inspect corners, jumps, moving platforms, camera occlusion, and unexpected escape paths.

### 8. Test checkpoints and navigation

- Restart from each checkpoint and inspect preserved state.
- Verify objectives remain reachable after deaths, shortcuts, and interrupted interactions.

### 9. Observe players

- Record route choices, backtracking, missed cues, and time at bottlenecks.
- Distinguish designer familiarity from first-time navigation evidence.

### 10. Hand off stable geometry

- Deliver dimensions, collision/navmesh needs, route evidence, and art constraints.
- Describe the blockout’s evidence level and unresolved player or content tests.

## Deliverables

- Route graph, metric sheet, and editable blockout.
- Encounter and checkpoint specification with state rules.
- Traversal evidence, observed defects, and art handoff constraints.

## Completion review

- All required routes are reachable using the selected controller.
- Collision and camera tests include narrow and vertical spaces.
- Checkpoint restarts preserve enough state to finish the level.
- Greybox screenshots are labeled as design evidence, not final visual quality.

## Gotchas

- A top-down drawing hides vertical travel and camera restrictions.
- Final art can change cover, collision, landmarks, and perceived routes.
- Navigation mesh generation is not proof that players or agents can complete encounters.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [Prototype environment refinement and testing](https://learn.unity.com/course/creative-core-prototyping).
- [Input and interaction accessibility](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107).
