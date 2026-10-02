---
name: project-planning
description: "Turn a game development request into scoped tasks, dependencies, acceptance criteria, ownership, and evidence needs. Use for coordinating production work or clarifying scope; keep repository dependency ordering in DEVELOPMENT_PLAN and do not invent product roadmaps."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Project planning

Produce executable work with clear outcomes, dependencies, and review evidence.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- User intent, constraints, existing decisions, and current project evidence.
- Available roles, skills, tools, assets, engine access, and work already in progress.
- Requested planning surface: task proposal, local document, or authorized platform board.

## Procedure

### 1. Read the current state

- Inspect relevant decisions, existing tasks, and artifacts before proposing new work.
- Separate target-system documents from implemented behavior and current evidence.

### 2. Define the outcome

- Write the concrete player/user change and its scope.
- Identify non-goals and constraints without turning unconfirmed assumptions into requirements.

### 3. Split by reviewable result

- Make tasks produce artifacts or behavior with acceptance criteria.
- Avoid tasks defined only as vague activities such as improve quality.

### 4. Connect dependencies

- Name inputs another task must provide and what can proceed independently.
- Put repository work-package ordering only in docs/DEVELOPMENT_PLAN.md when editing it is authorized.

### 5. Assign capabilities and evidence

- Recommend roles and skills by actual work type and tool access.
- Name required verification level and acknowledge unavailable live environments.

### 6. Record uncertainty

- List genuine creative decisions, technical unknowns, and reversible defaults.
- Propose a concrete recommendation instead of a chain of routine approval questions.

### 7. Check execution realism

- Inspect task size, content/tool prerequisites, and coordination costs.
- Choose a small validation task when an external dependency is not yet established.

### 8. Deliver or update the plan

- Write the requested task proposal or use authorized platform tooling.
- Do not pretend a task is scheduled, assigned, or completed without observed platform state.

## Deliverables

- Outcome statement and scoped task records.
- Dependencies, ownership recommendations, and acceptance evidence.
- Decision/assumption record and next ready work.

## Completion review

- Each task has a result someone can inspect.
- Dependencies refer to actual artifact/task identifiers when available.
- Evidence requirements distinguish fake tests, live tools, and human judgment.
- Existing tasks and accepted user decisions are preserved.

## Gotchas

- Task estimates are planning judgments, not measured delivery guarantees.
- Do not persist platform tasks directly from frontend code or ad hoc SQLite writes.
- Planning permission does not automatically authorize public releases or external messages.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [Prototype choice reduces uncertainty; planning workflow is an original recommendation](https://learn.unity.com/course/creative-core-prototyping).
