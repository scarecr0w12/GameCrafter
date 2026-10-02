# Blender modeling: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original GameCrafter recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Modular wall

Requested result: Build a wall that snaps into a reusable corridor kit.

Recommended approach: Define grid dimensions and pivot; block openings; establish shared edge positions; add restrained bevels; export and assemble several instances.

Expected delivery: Deliver source, module dimensions, snapping capture and collision variant.

Review gates:

- Define module width/height/depth, grid spacing and the exact pivot location before placing detail geometry.
- Keep mating boundary vertices on shared coordinates and check their dimensions numerically in the source scene.
- Use a duplicated straight run, inside corner and opening to expose gaps, overlaps and inconsistent wall thickness.
- Keep visual bevels separate from contact geometry where the collider should present a flat gameplay surface.
- Export one wall and reassemble the same combinations in the selected engine using its snapping settings.
- Deliver dimension notes, assembled screenshots, source modifier stack and a collision visualization.

## Example 2: Sculpted creature

Requested result: Turn a dense creature sculpt into a deforming game mesh.

Recommended approach: Preserve sculpt; retopologize articulation; test poses before detail baking; prepare UVs; export a deformation test.

Expected delivery: Deliver sculpt, game mesh, wireframe and pose evidence.

Review gates:

- Keep the dense sculpt in a separate collection and build a game mesh that follows the silhouette rather than every wrinkle.
- Lay deformation loops around shoulders, hips, knees and facial motion according to expected movement.
- Test a rough rig at flexion/twist extremes before final UVs so topology corrections remain inexpensive.
- Compare joint volume and contour with wireframe visible; mark places where additional edges improve deformation.
- Unwrap only the approved topology, retaining high/low alignment for subsequent detail baking.
- Deliver rest/posed wireframes, exact game-mesh counts and a diagnostic export without claiming final animation acceptance.

## Example 3: Generated debris

Requested result: Clean an irregular generated mesh for environmental use.

Recommended approach: Inspect disconnected fragments and unseen interior faces; preserve silhouette; create LOD/collider separately; compare export to source.

Expected delivery: Deliver cleanup source and exact counts without claiming live validation unless performed.

Review gates:

- Inspect connected components and sort intentional fragments from tiny accidental islands or interior geometry.
- Use face orientation and cross-section views to identify inverted patches, hidden surfaces and thin contact areas.
- Compare cleanup silhouettes from the gameplay camera before deleting fragments that contribute to recognizability.
- Build a coarse LOD and collision copy independently; keep the cleaned visual source editable.
- Export/reimport and compare bounds, triangle counts and shading with the same camera and light.
- Deliver changed geometry notes and show the collider separately from the attractive visual mesh.

## Failure diagnosis

### Bevel appears uneven

Inspect nonuniform transforms and bevel settings on a copy before applying scale.
Compare the object with identity scale on a duplicate and inspect bevel units/clamp behavior.
If only corners differ, examine topology and overlap before applying transforms to the master.

### Shading pinches on a planar surface

Inspect triangulation, normals and hidden nonplanar geometry.
Triangulate a duplicate explicitly and inspect diagonal direction under a moving light.
Distinguish nonplanar faces from weighted/custom-normal problems and redundant interior faces.

### Retopology follows sculpt but deforms badly

Redistribute edges around joint movement and test extreme poses.
Pose the mesh in bend and twist separately to locate where edge flow resists motion.
Compare joint placement and volume preservation before increasing total density.

### Decimation meets count but destroys silhouette

Compare at target distance and preserve outline-critical regions.
Overlay the decimated silhouette with the source at target distance.
Protect outline, opening and contact edges; reduce hidden/flat regions instead of uniformly preserving all triangles.

### Mesh is watertight yet gameplay collision fails

Review collider complexity, contact shape and engine collision settings.
Test collision as its own geometry and settings problem.
Display contact points and check channels, concavity and thin surfaces rather than using manifoldness as the acceptance test.

### Headless script reports success but scene is empty

Inspect saved object inventory and open or render the actual file.
List saved meshes/collections and render a known diagnostic camera.
Distinguish wrong output path, disabled collection, missing evaluated geometry and actual empty scene.

### Export changes the form

Check evaluated modifiers, triangulation and unsupported nonmesh content.
Compare source, evaluated mesh and reimported payload side by side.
Disable modifiers one at a time on a copy to find the step responsible for dimension or silhouette changes.

### Procedural model becomes impossible to edit

Retain construction source and bake only a deliberate export copy.
Check whether source retains modifiers, node groups and input parameters.
Rebuild the export variant from a checkpoint and document which operations intentionally discard construction history.

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

- [Poly Build](https://docs.blender.org/manual/en/4.5/modeling/meshes/tools/poly_build.html)
- [UV editing](https://docs.blender.org/UATEST/manual/en/4.5/modeling/meshes/uv/editing.html)
- [glTF exporter](https://docs.blender.org/manual/sl/4.5/addons/import_export/scene_gltf2.html)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
