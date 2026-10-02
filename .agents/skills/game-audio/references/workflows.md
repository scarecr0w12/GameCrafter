# Game audio: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original GameCrafter recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Footstep set

Requested result: Create varied steps for stone and soil.

Recommended approach: Preserve source; edit attacks; balance variations; choose spatial delivery; test rapid repetition and concurrent footsteps.

Expected delivery: Deliver cue groups, masters and in-engine listening notes.

Review gates:

- Record surface categories, cue variants, intended spatial behavior and source rights before editing.
- Align the audible attack with the step event, retaining intentional texture while removing accidental leading silence.
- Compare each variation at matched playback gain for timbre and perceived intensity; avoid identical peak-only leveling.
- Choose mono/stereo from the actual spatialization contract and listen after import through the intended bus.
- Trigger rapid repeats and multiple actors, checking machine-gun repetition, masking, clipping and voice limits.
- Deliver masters, encoded variants, cue-group membership and timing/attenuation/concurrency notes.

## Example 2: Ambient loop

Requested result: Prepare a wind bed that repeats without an obvious seam.

Recommended approach: Build stable boundaries; annotate units; export; listen to multiple wraps after import with bus effects.

Expected delivery: Deliver loop coordinates and audible review evidence.

Review gates:

- Specify sample rate and loop coordinates with units; for a hypothetical 48000 Hz source, sample 96000 corresponds to 2 seconds.
- Construct boundaries with compatible waveform/envelope and preserve the intended ambience evolution.
- Check whether the target supports separate loop start/end or only a loop-begin offset.
- Listen to repeated wraps after encoding and importer conversion, with the target bus effects enabled.
- Compare start playback, steady looping, pause/resume and stop behavior to avoid unintended tails or delayed entry.
- Deliver loop coordinate/unit notes, exported format and a listening record identifying exact imported variants.

## Example 3: Combat mix review

Requested result: Several feedback sounds mask dialogue during combat.

Recommended approach: Reproduce simultaneous triggers; compare bus gains, frequency overlap and voice priorities; adjust and listen again.

Expected delivery: Deliver before/after capture and measured runtime limits.

Review gates:

- Reproduce a fixed encounter containing dialogue, weapon reports, impacts, footsteps and ambient layers.
- Record bus routing, gains, ducking/priority rules and maximum overlapping voice conditions.
- Listen to dialogue intelligibility and urgent cues at normal volume before adjusting isolated waveforms.
- Compare spectral masking and overlap timing; change one bus/priority setting at a time.
- Check output peaks/headroom and voice stealing during the same worst-case sequence after adjustments.
- Deliver a mix-change table, representative capture and separate measured memory/CPU/concurrency results.

## Failure diagnosis

### Sound starts late

Inspect accidental leading silence and trigger-to-playback timing separately.
Compare event timestamp to playback start and inspect waveform attack position.
Separate source silence, import trimming, scheduling latency and slow loading before moving gameplay events.

### Loop clicks after export

Check loop boundary waveform and encoded/imported playback rather than master alone.
Listen to a raw PCM control and then the encoded/imported loop.
Inspect boundary amplitude/slope and coordinate units; if only compressed playback clicks, isolate decoder/import loop behavior.

### Normalization destroys mix hierarchy

Choose role-specific gain and headroom targets and listen in context.
Compare dialogue, ambience and action cues in one fixed mix sequence.
Treat peak and loudness measurements as different evidence, preserving intended gain relationships and output headroom.

### Spatial effect sounds oddly wide

Inspect stereo source behavior and target spatialization configuration.
Listen with a stationary source then move it around the listener.
Compare mono/stereo source, attenuation and spatializer behavior before changing the actual sound design.

### Compressed ambience costs too much CPU

Measure concurrent decode load and compare consumer-supported alternatives.
Profile the same concurrent voice set using alternate supported encodings.
Separate streaming I/O, decode load and effects processing so reducing sample rate does not conceal the real cause.

### Finished callback never occurs

Check whether looping intentionally prevents end-of-stream completion.
Inspect looping/stop settings and compare a nonlooping control stream.
Test explicit stop completion separately from wrap behavior instead of expecting every loop to act as end-of-file.

### Quiet effects disappear during combat

Review frequency masking, bus balance and voice priorities.
Play isolated cue, mixed cue and priority-limited cue in sequence.
Distinguish frequency masking, bus attenuation and dropped voices; preserve urgent feedback when altering concurrency rules.

### Music transition loses sync

Compare tempo/beat metadata, trigger timing and supported engine transition behavior.
Compare beat duration and transition trigger timestamps with source tempo.
Verify the selected engine actually consumes tempo metadata and supports the desired quantized transition.

## Reproducible delivery record

Record the following in the task's normal artifact notes; do not introduce a separate platform persistence format.

| Field          | What to capture                                                          |
| -------------- | ------------------------------------------------------------------------ |
| Purpose        | Asset role and intended gameplay presentation                            |
| Source         | Editable project path and source revision                                |
| Provenance     | Input rights, vendor/job identifier if relevant, generation/edit history |
| Tool versions  | DCC, exporter, engine and importer actually used                         |
| Contract       | Units, dimensions, timings, channel/anchor/skeleton rules as relevant    |
| Budget         | Agreed limits and measured values, including target hardware/context     |
| Export         | Payload paths and dependent-file inventory                               |
| Import         | Target scene/project and exact importer settings                         |
| Evidence       | Report/capture paths, pass/fail and the variant tested                   |
| Remaining work | Checks not run, failed checks and acceptance decisions                   |

## Review without fabricated evidence

A generated preview is evidence of the preview only.
A saved native file needs inspection before claiming editability.
A validator report establishes the checks that validator actually performs.
A successful import does not establish gameplay behavior or performance.
A local test does not establish every supported engine or renderer.
When no live tools are available, deliver editable instructions/artifacts where possible and label checks not run.
Do not silently substitute a paintover for a target-engine capture.
Do not replace a failed gate with a more flattering render.

## Primary sources

- [Godot audio import](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html)
- [Audacity loudness normalization](https://manual.audacityteam.org/man/loudness_normalization.html)
- [Audacity scripting reference](https://manual.audacityteam.org/man/scripting_reference.html)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
