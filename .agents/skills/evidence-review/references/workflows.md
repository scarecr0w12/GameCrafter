# Evidence review: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** A report says multiplayer is fully tested after mock RPC tests.

**Initial investigation:** Inspect tests and identify which transport/session behavior is substituted.

**Proposed action:** Accept contract checks but require a separate-process live scenario for network claims.

**Expected handoff:** Fake-tested contract status and explicit pending integration evidence.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Grade a claim against its artifact | Artifact match: Identifiers agree or stale evidence is qualified. |
| Inspect result integrity | Coverage: Each criterion has evidence or an explicit gap. |
| Check acceptance coverage and missing evidence | Environment: Substitutions and live boundaries are visible. |
| Calibrate the completion statement | Result integrity: Conclusions match actual results. |

## Detailed scenarios

### 1. Grade a claim against its artifact

- Use the claim Checkpoint restoration works and identify the exact candidate revision, saved fixture, and accepted restoration rules.

- Divide it into serialized state correctness, engine spawn ordering, player placement, and packaged persistence behavior.

- Map each claim to source review, fake-tested unit checks, live engine interaction, or target build evidence.

- Treat these as evidence categories rather than a universal numerical score; coverage and relevance matter more than category alone.

- If an artifact identifier differs from the candidate, inspect whether the final change affects the tested behavior.

- Deliver a claim/artifact/environment/outcome table with supported and unverified portions clearly separated.

### 2. Inspect result integrity

- Open the actual test output and check selected target, test count, skips, failures, and warnings.

- For screenshots, inspect the requested state, capture origin, and whether the image is a render study or a running interaction.

- For profiler claims, open baseline/candidate metadata and verify comparable settings and workload.

- For integration claims, identify substituted services, mock transports, or offline fixtures that narrow the result.

- If an exit code is zero but no relevant scenario ran, classify that command as setup evidence rather than a passed behavior test.

- Keep contradictory observations and failed cases beside successes so the reviewer sees material limitations.

### 3. Check acceptance coverage and missing evidence

- List required cases such as normal restore, key consumed before death, level transition, and corrupt save recovery.

- Match each case to a named assertion or recorded interaction, not merely a test filename suggesting coverage.

- Inspect edge cases newly affected by the final patch and avoid requiring unrelated broad checks without a reason.

- Choose the smallest missing scenario likely to change acceptance; explain what failure it could expose.

- If the engine is unavailable, provide the concrete fixture and run instructions while marking execution unverified.

- Deliver coverage gaps ranked by impact rather than a ceremonial all-green checklist.

### 4. Calibrate the completion statement

- Rewrite Implemented and fully tested as a precise supported result, such as serialized checkpoint rules passed fake-backed tests.

- Add live engine restoration verified only when a saved engine run concerns the final candidate.

- Describe art quality as reviewed imagery and human preference as participant feedback, not a runtime test conclusion.

- Use actual target measurements for performance and separate store upload from reviewed or published state.

- If evidence conflicts, state the narrower result and name the unresolved case instead of averaging outcomes.

- Produce a reviewer-ready statement with artifact links, material limits, and the next required acceptance check.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Claim-to-artifact evidence table.
- Supported status and material limitations.
- Targeted missing checks with purpose.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Every completion claim identifies evidence tied to the current artifact.
- Fake and live environments are explicitly distinguished.
- Contradicting results are included rather than averaged away.
- No claim implies human preference or legal certification from automated checks.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Engine tests have distinct scopes and state requirements](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine).
- [Target-platform profiling is a distinct capture workflow](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
