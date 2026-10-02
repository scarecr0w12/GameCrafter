---
name: evidence-review
description: "Review whether implementation, art, testing, performance, research, or release claims are supported by their artifacts. Use before reporting completion or promoting status; distinguish proposed, source-reviewed, fake-tested, live-verified, and human-reviewed evidence."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Evidence review

Make the strength and limits of a completion claim clear enough for a reviewer to assess.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Claim under review, acceptance criteria, source revision, and relevant artifacts.
- Commands/logs, screenshots, recordings, traces, test configuration, and provenance.
- Target environment and any fake services, mocks, or substituted assets.

## Procedure

### 1. State the claim precisely

- Rewrite vague words such as works or optimized into observable behavior.
- Keep separate claims for implementation, runtime behavior, visual quality, and performance.

### 2. Identify the artifact

- Resolve revision, file, build, asset, capture, or platform identifier.
- Check evidence actually concerns that artifact rather than an older candidate.

### 3. Classify the evidence

- Distinguish source review, automated fake tests, live integration, packaged target, and human review.
- Record how much of the target behavior each type covers.

### 4. Inspect reproducibility

- Check environment/version, command, inputs, seeds, and expected result.
- Mark missing setup as a reproduction limit rather than inventing it.

### 5. Find unsupported leaps

- Look for mocks presented as live tools, render studies presented as gameplay, or FPS guesses presented as measurements.
- Map each claim to supporting and contradicting evidence.

### 6. Check acceptance boundaries

- Compare coverage with required edge cases and environment.
- Name omitted failures and whether they materially prevent completion.

### 7. Recommend targeted verification

- Choose the smallest missing check that could change the conclusion.
- Do not rerun unrelated tests after sufficient evidence already exists.

### 8. Deliver calibrated status

- State supported result, qualification, and remaining check.
- Update durable status only through authorized repository or service surfaces.

## Deliverables

- Claim-to-artifact evidence table.
- Supported status and material limitations.
- Targeted missing checks with purpose.

## Completion review

- Every completion claim identifies evidence tied to the current artifact.
- Fake and live environments are explicitly distinguished.
- Contradicting results are included rather than averaged away.
- No claim implies human preference or legal certification from automated checks.

## Gotchas

- A screenshot shows one state rather than a complete interaction.
- A command exit code may conceal skipped tests or wrong targets.
- Source availability is not evidence an integration ran successfully.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that GameCrafter has executed them.
Last researched: 2026-10-01.

- [Engine tests have distinct scopes and state requirements](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine).
- [Target-platform profiling is a distinct capture workflow](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
