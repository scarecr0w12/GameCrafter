# Game performance: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Entering a village causes intermittent frame hitches.

**Initial investigation:** Reproduce the entry route and capture timing/loading traces on target hardware.

**Proposed action:** Identify expensive work, change one cause, and compare the same entry sequence.

**Expected handoff:** Raw captures, frame-time comparison, and observed gameplay/visual tradeoffs.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Capture a comparable baseline | Baseline: Build/settings/hardware plus raw trace. |
| Test one causal optimization | Candidate: Comparable time/resource report. |
| Inspect visual and behavioral tradeoffs | Correctness: Assertions or captures relevant to the change. |
| Diagnose sustained growth and release-like behavior | Sustained load: Memory/frame pacing trend and test duration. |

## Detailed scenarios

### 1. Capture a comparable baseline

- Use a fixed village-entry route with the same camera, encounter population, resolution, and graphics configuration.

- Record target hardware, candidate revision, engine build, instrumentation settings, warmup, and capture duration.

- Collect at least the frames containing the reported hitch and nearby steady frames using the available profiler.

- Inspect whether CPU, GPU, waiting, loading, or allocations dominate; preserve raw trace rather than only average FPS.

- If the hitch is intermittent, repeat the same route and record cache/warmup conditions instead of changing several variables.

- Deliver a capture recipe and marked trace interval that another collaborator can reproduce.

### 2. Test one causal optimization

- Choose a hypothesis such as repeated synchronous asset loading during village entry based on the baseline trace.

- Inspect ownership and timing dependencies before proposing asynchronous loading or reuse; account for failure and cancellation.

- Change that cause alone where practical and repeat the original route with matching settings.

- Compare relevant frame-time distribution, hitch duration, or subsystem time from saved captures.

- If improvement moves cost elsewhere, inspect memory residency, load latency, and behavior rather than celebrating one reduced marker.

- Report baseline/candidate numbers with capture links and label uncertain or noisy differences.

### 3. Inspect visual and behavioral tradeoffs

- After reducing distant NPC update frequency, test approach, combat start, retreat, and camera turns in the original workload.

- Inspect delayed reactions, navigation recovery, animation, and gameplay fairness alongside CPU timing.

- For a rendering-quality change, compare matched camera screenshots in bright/dark and movement-heavy scenes.

- Check whether the cheaper setting removes essential gameplay information, cover silhouettes, or accessibility cues.

- Choose a quality/budget tradeoff explicitly and retain the original visual or behavioral contract when it is required.

- Deliver regression captures and the proposed player-visible tradeoff; timing gain alone is insufficient acceptance.

### 4. Diagnose sustained growth and release-like behavior

- For a suspected leak, repeat level entry/exit a fixed number of times and sample memory after comparable settling periods.

- Distinguish cached resources from continuously retained objects using ownership/allocation evidence supported by the tool.

- For mobile or sustained-load issues, record session length, thermal/power conditions, and frame pacing where observable.

- Run a release-like build on the target when available and identify what instrumentation is absent from that measurement.

- If only editor profiling is available, deliver the diagnosis and exact target-device check still required.

- Keep trends and environment metadata; do not assert long-session stability from a short editor trace.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Repeatable capture recipe and baseline artifacts.
- Causal bottleneck analysis and focused optimization.
- Comparable results, tradeoffs, regression evidence, and remaining limits.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Before/after captures use matching workload and settings.
- Reported improvements use timing or resource numbers from saved evidence.
- Visual/gameplay changes are explicit and reviewed.
- Long-running memory or thermal behavior is tested when relevant to the failure.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Target-device capture](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
- [Timing, memory, network, cooking, UI, and audio traces](https://dev.epicgames.com/documentation/unreal-engine/unreal-insights-in-unreal-engine?lang=en-US).
