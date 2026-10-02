# Sprite production: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original PlayWeld recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Eight-frame run

Requested result: Create a small character run that stays grounded.

Recommended approach: Define canvas and foot anchor; draw key contact/passing poses; set durations; export metadata; play at fixed origin.

Expected delivery: Deliver editable animation, atlas and grounding review.

Review gates:

- Record logical canvas dimensions and a fixed foot-contact anchor before drawing any frame.
- Draw contact/passing/key airborne poses first and inspect silhouette at integer gameplay scale.
- Overlay frames at the same origin to distinguish deliberate body motion from accidental size or anchor drift.
- Set frame durations explicitly and identify event frames such as foot contact independently of atlas position.
- Export image plus metadata; assert frame rectangles stay within atlas bounds and durations/tag ranges are valid.
- Play the imported run against a stationary floor line, checking contacts and speed with intended filtering.

## Example 2: Generated sheet repair

Requested result: A generated four-by-four strip contains uneven cells.

Recommended approach: Inspect actual frame boundaries; isolate frames; normalize anchors/scale without distorting anatomy; rebuild tagged sheet.

Expected delivery: Deliver corrected frames and documented art changes.

Review gates:

- Inspect the generated image dimensions and actual cell boundaries rather than assuming the advertised grid is accurate.
- Extract frames without resizing, recording original bounds and any damaged/overlapping frame regions.
- Choose a common anatomical scale and anchor; correct translation first and avoid stretching limbs to fit cells.
- Review alpha edges, silhouette continuity and accidental background pixels against contrasting colors.
- Rebuild tagged editable frames and export a new atlas with source-rectangle offsets preserved.
- Deliver a before/after contact sheet and playback at fixed origin, identifying any redraws or replaced poses.

## Example 3: Terrain tileset

Requested result: Produce modular grass and cliff tiles for an orthographic game.

Recommended approach: Set grid; design edges/corners; test repeated patches; export atlas; verify engine sampling and map combinations.

Expected delivery: Deliver editable tiles, combination preview and import settings.

Review gates:

- Define tile pixel dimensions, world grid size and required edge/corner transition combinations.
- Draw repeated three-by-three test patches and mixed terrain boundaries to expose directional seams.
- Compare palette and texture frequency with character sprites at the same presentation scale.
- Export with deliberate border padding/extrusion and record whether the consumer uses nearest or linear sampling.
- Test exact pixel alignment, integer and noninteger zoom, map edges and atlas-adjacent cells in engine.
- Deliver source tiles, combination map, atlas metadata and captures of the intended sampling configuration.

## Failure diagnosis

### Trimmed frames jump during playback

Restore source rectangle offsets and anchor interpretation.
Compare sourceSize/spriteSourceSize or equivalent offsets with the fixed pivot.
Render an untrimmed control sheet; if it remains stable, the importer offset/anchor interpretation is responsible.

### Adjacent sprite bleeds into a frame

Inspect atlas padding, extrusion and filtering at all intended zoom levels.
Inspect atlas gutters at the sampled mip and rotate/zoom the camera to reproduce bleed.
Compare nearest/linear filtering and ensure extruded edge color comes from the correct frame.

### Generated strip has inconsistent character sizes

Normalize against the agreed anchor and scale, then inspect silhouette frame by frame.
Overlay extracted frames against one agreed skeleton/silhouette guide.
Correct anchor translation separately from scale, and redraw inconsistent anatomy rather than uniformly warping it.

### Animation speed differs in engine

Compare duration units and importer handling of per-frame timing.
Check whether durations are milliseconds or engine ticks/seconds and whether the importer preserves per-frame durations.
Compare total clip duration with metadata before applying a global speed multiplier.

### Duplicate-frame merge changes timing

Keep timing metadata independent of atlas pixel deduplication.
Compare logical frame sequence/durations before and after deduplication.
Shared pixel rectangles should not merge distinct timing or gameplay-event entries.

### Tile seam appears only in the engine

Inspect sampling, placement alignment and border pixels with actual zoom.
Test an unatlased tile and then the same tile in the atlas.
Distinguish edge artwork mismatch from fractional placement, filtering, camera zoom and adjacent-cell sampling.

### Transparent edges show dark halos

Check edge colors and alpha handling under the target blending mode.
Preview alpha over both white and black backgrounds and compare blend conventions.
Check transparent-edge RGB values and extruded borders before painting opaque outlines.

### Mirrored attack swaps meaningful equipment

Author the required direction variant instead of blindly mirroring.
List direction-dependent equipment, lighting and attack poses.
Compare the mirrored silhouette with the approved facing contract and author separate frames where semantics change.

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

- [Aseprite CLI](https://www.aseprite.org/docs/cli/)
- [Sprite sheet documentation](https://www.aseprite.org/docs/sprite-sheet/)
- [Slice metadata](https://www.aseprite.org/docs/slices/)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
