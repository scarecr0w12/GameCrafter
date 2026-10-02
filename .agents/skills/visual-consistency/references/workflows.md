# Visual consistency: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original GameCrafter recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Prop family review

Requested result: Three vendors supplied crates that should fit one settlement.

Recommended approach: Normalize camera and lighting; compare proportions, edge wear, palette and texture scale; adjust one exemplar before the family.

Expected delivery: Deliver annotated comparisons and a reusable construction brief.

Review gates:

- Place each crate at the same world size and render three-quarter, side and top views with one camera/exposure setup.
- Annotate contour proportions, bevel width relative to scale, handle construction and major value groups.
- Compare roughness response under both broad light and a moving highlight; avoid judging material only from painted colors.
- Create one approved exemplar showing permissible wear placement and the ratio of clean to damaged surfaces.
- Review the exemplar at normal interaction distance before applying rules to the remaining family.
- Deliver a family contact sheet with each proposed change linked to an observable rule or intentional exception.

## Example 2: Terrain study

Requested result: Explore a fractured valley without committing to production terrain.

Recommended approach: Provide broad region composition, connected surface geography and scale markers; label paintovers; keep secrets and detailed resources discoverable in-world.

Expected delivery: Deliver study images and editable scene if requested, with production checks outstanding.

Review gates:

- Keep the study within one continuous surface region; label any future expansion outside the current request.
- Use a scale marker, horizon and connected ground routes to make cliff/valley proportions assessable.
- Prepare wide composition and a close terrain segment so the same material and fracture rules can be compared.
- Annotate slope rhythm, dominant rift, secondary erosion and material transitions without enumerating discoverable secrets.
- Distinguish direct scene renders from paintovers and keep the editable scene construction available where requested.
- Review the study for composition and scale only; leave traversal, collision and streaming marked not run.

## Example 3: Character readability

Requested result: An enemy reads well in portraits but poorly during combat.

Recommended approach: Review silhouette and value against actual backgrounds; reduce noisy details; test movement and hit feedback at gameplay distance.

Expected delivery: Deliver before/after gameplay-size comparisons and remaining engine validation needs.

Review gates:

- Capture the enemy at actual combat size against bright, dark and visually busy encounter backgrounds.
- Compare a black silhouette and grayscale frame before adjusting surface textures or emissive accents.
- Identify which movement pose and contour distinguish the enemy role from allies and background props.
- Reduce detail clusters that compete with the head, weapon or attack anticipation; compare the same motion frame.
- Test readability during attack anticipation, hit response and recovery, including overlaps with effect layers.
- Deliver consistent camera captures and note whether the result was an art mockup or exercised gameplay scene.

## Failure diagnosis

### All assets use one palette but still clash

Compare shape proportions, edge treatment and detail frequency.
Build a monochrome contact sheet to remove palette as a variable.
Compare relative head/handle/edge proportions and ornament spacing to identify structural style drift.

### Concept paintover looks cohesive; engine scene differs

Compare exposure, tone mapping, roughness and lighting using direct captures.
Render the same camera with neutral materials and then original materials.
This separates composition differences from exposure, tone mapping, light placement and surface response.

### Generated variations drift between runs

Supply approved anchor views and evaluate silhouette before selecting texture-rich candidates.
Compare multiple views of each candidate against the accepted anchor.
Reject shape drift before choosing a polished surface, and record the prompt/reference changes producing the closest form.

### Character disappears in the environment

Inspect grayscale contrast and background complexity at gameplay scale.
Inspect a grayscale gameplay frame with the character stationary and moving.
Change either contour separation or background complexity first, then test with effects and UI present.

### Large asset looks miniature

Compare texture scale, bevel size and contextual reference dimensions.
Place a measured reference object beside the asset and inspect texture repetitions.
Distinguish inconsistent units from oversized grain, bevels or repeating features.

### Style guide contains only adjectives

Replace each adjective with an observable rule and an accepted example.
For each broad adjective, write one observable construction rule and pair accepted/rejected examples.
Check whether a second author can identify the same difference without verbal coaching.

### Consistency removes regional identity

Use shared construction rules with deliberate local palette and material variation.
Compare regions using common contour/material construction rules while varying approved local motifs.
Record purposeful contrast rather than averaging every regional asset into one look.

### Reference board copies a protected design

Use references to explain principles; produce original silhouettes and provenance notes.
Trace which reference contributes palette, proportion or material principles.
Produce original arrangement and silhouettes, retaining rights/provenance notes without copying a distinctive protected design.

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

- [PBR reference](https://www.khronos.org/gltf/pbr/)
- [Sample Viewer lighting and debug tools](https://github.com/KhronosGroup/glTF-Sample-Viewer)
- [PBR sample assets](https://github.com/KhronosGroup/glTF-Sample-Assets)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
