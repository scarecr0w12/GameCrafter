---
name: source-research
description: "Research game development tools, engine APIs, standards, production workflows, or disputed facts using primary sources and save a dated evidence note. Use when a design or implementation depends on current external facts; separate observed documentation from recommendations."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Source research

Answer a bounded question with opened primary sources, version context, and useful verification caveats.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Decision/question, relevant engine or tool version, and intended output location.
- Known sources, local installed code/docs, freshness requirements, and unresolved claims.
- Scope limits: public documentation versus accounts or live execution unavailable in this task.

## Procedure

### 1. Bound the question

- Identify facts that could change the decision or implementation.
- Exclude adjacent topics unless they resolve a named uncertainty.

### 2. Find primary sources

- Prefer official manuals, specifications, repositories, and vendor support documents.
- Search results are discovery aids; open the pages before relying on their claims.

### 3. Check versions and dates

- Distinguish stable release, latest/unstable documentation, and moving aliases.
- Record last researched date and observed version; do not invent publication metadata.

### 4. Extract bounded facts

- Write concise paraphrases with a source URL near each factual claim.
- Record restrictions, exceptions, and prerequisites alongside the advertised capability.

### 5. Compare relevant alternatives

- Use the same criteria and do not infer absent features from silence.
- Label unavailable or blocked evidence as unverified.

### 6. Separate judgment

- Explain what is inferred and why it follows from the sources.
- State recommendations as selected defaults or proposals rather than user-confirmed requirements.

### 7. Write the note

- Use a purpose, sourced findings, implications/caveats, and deduplicated sources.
- Use gamecrafter-research-note when writing docs/research in this repository.

### 8. Review and hand off

- Check links and identify facts needing installed-version or live verification.
- Do not call research alone a benchmark, certification, or implemented integration.

## Deliverables

- Dated research note with near-claim URLs.
- Decision-relevant comparison or recommendation.
- Version/freshness caveats and live-verification gaps.

## Completion review

- Factual claims cite opened sources that directly support them.
- Latest/unstable docs are not silently treated as installed stable behavior.
- Recommendations and inferences are labeled.
- Unknown license/pricing/runtime facts stay unverified.

## Gotchas

- A vendor domain may host community material rather than vendor-authored guidance.
- Documentation examples often omit production error handling.
- Access failure is missing evidence, not evidence of missing functionality.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [Example primary narrative manual](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).
- [Example version-specific engine testing manual](https://docs.unity3d.com/Packages/com.unity.test-framework@2.0/manual/edit-mode-vs-play-mode-tests.html).
