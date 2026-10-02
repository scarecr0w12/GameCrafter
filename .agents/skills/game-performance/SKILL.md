---
name: game-performance
description: "Profile and improve game CPU, GPU, memory, loading, network, or frame pacing using repeatable target-device measurements. Use for slow frames, hitches, budget overruns, or optimization requests; require comparable captures for measured improvement claims."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game performance

Find and reduce a measured bottleneck while preserving the intended game behavior and visual result.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Target hardware/platform, frame-time/memory/loading budgets, and representative workload.
- Build/version, graphics settings, scene/seed, and known reproduction conditions.
- Available profiler/capture tools and existing baseline artifacts.

## Procedure

### 1. Define the budget

- Convert frame-rate goals into frame-time limits and define memory/loading targets.
- Separate median performance from hitches and worst representative scenes.

### 2. Make the workload repeatable

- Fix scene, camera path, inputs, content, resolution, and settings.
- Record warmup and capture length; identify unavoidable environmental variation.

### 3. Build for the target

- Use profiling-capable builds and connect to the intended hardware.
- Record instrumentation settings because development/profiling overhead changes measurements.

### 4. Capture the baseline

- Collect CPU/GPU timing, allocations/memory, and relevant subsystem traces.
- Keep raw artifacts and metadata rather than only a screenshot of a summary.

### 5. Locate the limiting work

- Identify dominant timings or memory growth with call stacks/markers where available.
- Distinguish CPU, GPU, synchronization, loading, and network symptoms.

### 6. Choose a causal change

- Form one specific optimization hypothesis and inspect behavior dependencies.
- Estimate visual/gameplay tradeoffs before reducing quality or update frequency.

### 7. Implement and compare

- Change one cause, rerun the same workload, and preserve comparison settings.
- Report frame-time distributions or subsystem timings relevant to the original problem.

### 8. Check regressions

- Inspect representative gameplay, screenshots, streaming transitions, and memory cleanup.
- Use limits and meaningful scenarios rather than tests that merely mirror the implementation.

### 9. Inspect production implications

- Check a release-like build and representative sustained workload where feasible.
- Label target-device, editor-only, and instrumented results distinctly.

### 10. Deliver measured findings

- Include baseline, candidate, hardware, settings, trace links, and uncertainty.
- If tools or hardware are unavailable, deliver a diagnosis plan without fabricated speedup.

## Deliverables

- Repeatable capture recipe and baseline artifacts.
- Causal bottleneck analysis and focused optimization.
- Comparable results, tradeoffs, regression evidence, and remaining limits.

## Completion review

- Before/after captures use matching workload and settings.
- Reported improvements use timing or resource numbers from saved evidence.
- Visual/gameplay changes are explicit and reviewed.
- Long-running memory or thermal behavior is tested when relevant to the failure.

## Gotchas

- Editor time includes costs that may differ from a shipped game.
- Average FPS can conceal severe frame-time spikes.
- Deep instrumentation can change the bottleneck being measured.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [Target-device capture](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
- [Timing, memory, network, cooking, UI, and audio traces](https://dev.epicgames.com/documentation/unreal-engine/unreal-insights-in-unreal-engine?lang=en-US).
