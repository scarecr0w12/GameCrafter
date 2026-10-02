# Asset pipeline: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original PlayWeld recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Generated rock handoff

Requested result: A generated GLB should become a reusable climbable prop.

Recommended approach: Check dimensions and surface defects; retain original and cleanup source; create a simple collider; validate GLB; test traversal contact in an isolated engine scene.

Expected delivery: Deliver source, GLB, collider, counts and a contact test capture.

Review gates:

- Record source bounds and intended placement beside a known-height character; verify the imported bounds use the same units.
- Inspect disconnected fragments, inward normals and self-intersections under wireframe and face-orientation views.
- Mark climbable/contact faces and construct a separate simple collider that matches those contact surfaces.
- Export without unrelated cameras/lights; compare exported material, vertex and triangle counts with source counts.
- Run the GLB validator and inspect the saved payload in a viewer from above, below and the gameplay camera.
- Place several rocks in the target scene; test contact and traversal, then record physics settings and unsupported surfaces.

## Example 2: Animated character transfer

Requested result: Move one authored walk clip from Blender into a selected engine.

Recommended approach: Agree skeleton/root motion; export one clip; inspect it independently; import and compare clip duration, root displacement and joint extremes.

Expected delivery: Deliver settings, clip inventory and engine playback evidence.

Review gates:

- Write the joint hierarchy, rest-pose reference, clip name and root-motion owner into the handoff record.
- Choose one diagnostic walk with clear foot contacts; compare exact duration and root displacement before and after export.
- Inspect exported joints, skin influences and inverse-bind data rather than counting only source bones.
- Check import transforms using a known-size reference and compare the resting character silhouette.
- Play the clip at its declared speed, watching for foot sliding and joint collapse at contact extremes.
- Record a clip table and side-by-side playback; mark retargeting, blend transitions and other engine targets separately.

## Example 3: Asset memory reduction

Requested result: Reduce a material-heavy building without losing its focal detail.

Recommended approach: Measure baseline; combine only compatible materials; reduce textures by viewing distance; produce LODs; compare profiles under repeated instances.

Expected delivery: Deliver before/after appearance and measured memory/draw-call values.

Review gates:

- Inventory material slots, mesh sections, texture sizes and runtime memory before combining anything.
- Separate shared surfaces from special transparency or shader features that cannot safely share one material.
- Create one reduced variant and compare facade silhouette, signs and focal details at near and far camera distances.
- Test LOD transitions at their chosen screen coverage and inspect texture density across adjacent modules.
- Measure repeated building instances with the same camera and renderer settings as the baseline.
- Report download bytes, imported texture memory, draw calls and frame time as separate values with visible tradeoffs.

## Failure diagnosis

### Source looks correct; export lost materials

Compare exporter-supported nodes and image references; bake or simplify only the export copy.
Test one plain diagnostic material first; if it also fails, inspect the importer/dependency paths before rewriting complex shaders.
Compare a relocated export with the original to separate missing images from unsupported material nodes.

### Triangle budget passes; runtime vertex count rises

Inspect UV and normal discontinuities and exported vertex statistics.
Compare exported vertex count per primitive with triangles and material splits.
Remove a diagnostic UV seam on a copy to see whether the count change comes from attributes rather than duplicated geometry.

### Viewer succeeds; engine import fails

Check required extensions and engine importer version before altering geometry.
List extensionsUsed/extensionsRequired and compare them with the actual importer capabilities.
Retry an uncompressed core-material export to isolate decoder/extension failure from corrupt payload data.

### Asset appears huge or tiny

Compare declared units, dimensions and import scale with a known-size reference.
Inspect source dimensions, export conversion and importer scale independently.
Use one calibration cube and compare its measured bounds rather than visually compensating with camera distance.

### Generated model has attractive render but broken collider

Inspect topology and create a gameplay-specific collision representation.
Enable collider visualization and sweep the gameplay actor over a known contact edge.
Distinguish holes in the collider, excessive concavity, collision-channel mismatch and solver/contact settings.

### LOD transition flickers or pops

Compare silhouette and shading across actual screen-size transitions.
Freeze the camera at each LOD threshold and inspect both variants with identical materials.
Check whether silhouette loss, mismatched normals or incompatible material parameters causes the pop.

### Export loads locally but dependency is missing elsewhere

Move payload to a clean directory and test dependency resolution.
Copy the complete payload to a new directory and resolve only relative dependencies.
Check image URI spelling/case and whether the exporter saved an external image rather than embedding it.

### Optimization reduced bytes but worsened runtime

Measure decoder cost, draw calls and memory separately from download size.
Profile baseline and optimized variants with equivalent instances.
Separate CPU decode/import spikes, GPU texture residency and draw-call cost before choosing another compression or batching strategy.

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

- [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
- [Sample Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer)
- [Asset Auditor](https://www.khronos.org/blog/khronos-gltf-asset-auditor)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
