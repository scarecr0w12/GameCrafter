---
name: discussion-board-maintenance
description: "Reconcile project discussion threads with decisions, tasks, dependencies, and evidence using authorized board tooling. Use when asked to organize or update the PlayWeld board; draft changes if tools are unavailable and preserve decision history without inventing a board API."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Discussion board maintenance

Keep discussion context usable while preserving the difference between a proposal, a decision, and completed work.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Authorized board scope and actual available service/tool capabilities.
- Threads, comments, task records, current decisions, and relevant artifacts.
- Requested cleanup intent and user-confirmed decision authority.

## Procedure

### 1. Inspect the supported surface

- Discover authorized read/update tools and their contracts.
- Do not invent method names or bypass the platform service with direct database writes.

### 2. Read thread context

- Inspect the original request, later corrections, and linked task/evidence records.
- Keep actor, chronology, and unresolved disagreements visible.

### 3. Classify thread outcomes

- Separate information, proposal, confirmed decision, task, and blocked question.
- A confident agent comment does not constitute user confirmation.

### 4. Prepare concrete changes

- Propose titles, tags, links, summaries, and task associations based on content.
- Keep original text/history and avoid destructive deletion without its own authorization.

### 5. Reconcile dependencies

- Connect follow-up work to the exact decision and upstream artifacts.
- Flag duplicate tasks without silently canceling work another actor may be executing.

### 6. Write an evidence-aware summary

- Record what changed, who settled it, and what evidence supports completion.
- Preserve uncertainty and references to superseded proposals.

### 7. Apply authorized updates

- Use actual board/service operations within the task’s permission scope.
- If unavailable, deliver a precise change proposal; label it as unapplied.

### 8. Verify the resulting state

- Read back changed records and compare identifiers/content with the proposal.
- Report completed updates, unapplied drafts, and tool limitations separately.

## Deliverables

- Thread outcome map and proposed/applied changes.
- Decision/task/evidence links with preserved history.
- Read-back confirmation or explicit unapplied status.

## Completion review

- User-confirmed decisions retain their actor and context.
- No title/status implies work completed without evidence.
- Links resolve to the intended thread/task/artifact.
- Actual updates are distinguished from a Markdown draft.

## Gotchas

- Summarizing can erase an important dissent or constraint.
- No available board tool means no confirmed board mutation.
- Permission to maintain a board is not permission to send external email or chat.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- This maintenance procedure is an original recommendation based on the repository’s stated service-owned durable-state boundary; no external board API or execution result is claimed.
