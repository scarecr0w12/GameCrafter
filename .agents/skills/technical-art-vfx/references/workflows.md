# Technical art and VFX: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original PlayWeld recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Impact burst

Requested result: Create readable projectile impacts for a fast combat camera.

Recommended approach: Build one primary flash and secondary debris; align impact timing; test repeated triggers on different backgrounds; profile concurrency.

Expected delivery: Deliver source and target captures with frame-time evidence.

Review gates:

- Record impact timestamp and distinguish primary flash, directional debris and lingering smoke lifetimes.
- Match effect scale to the struck surface and compare near, normal and far combat camera distances.
- Review brightness/value over bright, dark and busy surfaces without changing camera exposure.
- Trigger repeated impacts and overlapping hits; ensure flashes communicate location without hiding characters.
- Check one-shot restart, completion and cleanup in the target effect lifecycle.
- Deliver material/emitter sources, timing table and concurrency profile with direct target captures.

## Example 2: Moving smoke trail

Requested result: Attach a smoke effect to a moving object without dragging old particles.

Recommended approach: Set world/local behavior deliberately; test rapid turns; extend bounds to trajectory; verify lifecycle and culling.

Expected delivery: Deliver settings and motion/camera-edge test evidence.

Review gates:

- Define whether newly emitted particles follow the object or remain in world space after emission.
- Move the parent through translation and rapid rotation to inspect trail continuity and unintended inherited motion.
- Measure the longest particle trajectory and set bounds around the full effect, not only the current emitter position.
- Move the camera across those bounds to detect premature culling and test offscreen emitter reentry.
- Check pause, stop, repeated activation and cleanup while parent motion continues.
- Deliver motion/culling captures and the chosen coordinates, lifetime, speed and bounds settings.

## Example 3: Flipbook handoff

Requested result: Transfer a simulated magical effect into a runtime atlas.

Recommended approach: Render transparent frames with stable framing; export timing/layout; inspect alpha; build target material; compare motion and cost.

Expected delivery: Deliver simulation source, atlas and runtime validation report.

Review gates:

- Lock simulation camera framing and scale across rendered frames, including transparent edge margins.
- Record frame order, duration, atlas layout and whether exposure/tone mapping is baked into images.
- Inspect individual frames over contrasting backgrounds and verify alpha/blend handling in the target material.
- Compare source and flipbook motion at matched timing; inspect first/last transition if looping is intended.
- Test oblique/near views, moving parent behavior and simultaneous quads for visible repetition/overdraw.
- Deliver simulation source, atlas/channel notes, material graph and separate appearance/performance comparisons.

## Failure diagnosis

### Effect disappears when emitter leaves view

Inspect visibility bounds against the full particle trajectory.
Display effect bounds while particles move and compare with their full lifetime envelope.
Test camera-edge exit with emitter stationary to separate culling from premature particle death.

### Trail rotates unexpectedly with actor

Check local/world coordinates and parent transforms.
Rotate and translate the parent independently while viewing an old emitted particle.
Check simulation coordinates, attachment hierarchy and transform inheritance rather than counter-rotating the texture.

### Repeated trigger produces no burst

Inspect one-shot restart/lifecycle state and emitter reset behavior.
Inspect the emitter state after completion and test explicit reset/restart.
Compare one-shot reuse with spawning a new instance; record whether the runtime owns pooling and reset.

### Transparent effect has a rectangular halo

Inspect alpha edges, color data and blend mode in the target renderer.
View the texture over light/dark backgrounds and inspect transparent-edge RGB.
Compare blend mode, emissive treatment and filtering before masking the rectangle with more particles.

### Collision leaks through thin surfaces

Compare speed, collision thickness and simulation update frequency.
Test one fast particle against a thick and thin collider, then vary simulation update rate.
Separate tunneling from unsupported collision shape or bounds exclusion and measure the added cost.

### Beautiful preview overwhelms gameplay

Reduce visual density and review at actual camera distance with multiple effects.
Review the effect during actual movement and simultaneous combat cues.
Reduce secondary layers first, preserving impact location and anticipation; compare player/target silhouettes before and after.

### Frame rate drops only with stacked effects

Measure overdraw and concurrent instances before reducing geometry blindly.
Compare GPU time with fixed particle count but reduced quad area/transparent layers.
Then vary simulation complexity separately to identify fill rate versus particle-processing cost.

### Baked effect differs from procedural source

Compare frame order, exposure, timing and unsupported shader behavior.
Inspect individual frames and a constant-rate playback control.
Compare exposure, alpha, frame indexing and unsupported procedural material channels before changing effect timing blindly.

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

- [Godot particle properties](https://docs.godotengine.org/en/stable/tutorials/3d/particles/properties.html)
- [Particle system overview](https://docs.godotengine.org/en/stable/tutorials/3d/particles/index.html)
- [Process material properties](https://docs.godotengine.org/en/stable/tutorials/3d/particles/process_material_properties.html)
- [Particle turbulence](https://docs.godotengine.org/en/stable/tutorials/3d/particles/turbulence.html)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
