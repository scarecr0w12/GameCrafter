# Materials and textures: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original PlayWeld recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Painted metal crate

Requested result: Create a reusable worn metal surface without baked lighting.

Recommended approach: Separate paint/metal masks; author roughness hierarchy; bake required detail; compare under changing light; inspect packed channels.

Expected delivery: Deliver master textures, runtime maps and material recipe.

Review gates:

- Write a destination channel table: base color, metallic, roughness, normal, occlusion and alpha, with color-space and packing semantics.
- Define paint as a separate material response from exposed metal; inspect masks in isolation before judging the shaded result.
- Use broad clean areas to establish base-color/roughness behavior, then place wear where the asset function supports it.
- Check UVs with a labeled checker and compare texel scale across lid, sides and handles.
- Inspect the same crate under neutral lighting and a moving highlight after target import, with exposure held constant.
- Deliver unpacked masters, packed runtime channels and the exact consumer material connections.

## Example 2: Normal bake repair

Requested result: A curved prop has seam artifacts after engine import.

Recommended approach: Compare topology/UVs/normals used for baking and export; check convention; inspect cage and padding; rebake a diagnostic region.

Expected delivery: Deliver before/after seam views and exact changed settings.

Review gates:

- Keep an unchanged failing export and isolate one seam region using a simple diagnostic material.
- Verify the low mesh used for baking and export has the same UVs, triangulation and shading normals.
- Inspect cage intersections; test reduced ray distance or separated bake groups to distinguish projection errors from tangent errors.
- Compare the normal image as numeric data and verify the destination green-channel convention with an asymmetric raised feature.
- Test padding at actual mip levels and compare hard-edge/UV-seam placement before raising image resolution.
- Deliver the cage, bake settings, changed low-mesh data and engine seam captures from the same camera.

## Example 3: Texture budget pass

Requested result: Reduce distant environment memory without losing focal landmarks.

Recommended approach: Classify viewing distances; reduce nonfocal maps; inspect mip behavior and texture scale; measure imported memory.

Expected delivery: Deliver per-texture changes and target measurements.

Review gates:

- Record each image dimension, channel use, color space, imported memory and near/far viewing role.
- Reduce one nonfocal texture at a time and compare signs, masks and repeated patterns at matched camera distances.
- Inspect smallest intended mips for island bleed and alpha loss; include oblique viewing angles.
- For packed maps, inspect individual channels after compression rather than accepting only a composite shaded preview.
- Measure imported/resident memory and actual material sampling cost separately from compressed file bytes.
- Deliver an asset-by-asset budget table with kept detail, visible compromises and unsupported encoding choices.

## Failure diagnosis

### Normal map dents appear raised

Check green-channel convention and tangent-space interpretation.
Apply a known asymmetric normal test patch and flip the green channel only on a copy.
If artifacts persist, compare tangent generation, mesh normals and mirrored UVs instead of repeatedly flipping channels.

### Roughness appears unexpectedly bright or dark

Inspect color-space handling and channel packing.
Display the sampled roughness channel as grayscale with constant lighting.
Check whether a packed green/blue channel or gamma conversion is wrong before editing the painted roughness values.

### Bake is blank or writes the wrong image

Check selected objects, active destination and target image node.
Confirm the intended image exists, is active on the destination and can be saved.
Bake a constant emission color first to separate target/selection failure from high-to-low projection failure.

### Dark seams appear only at distance

Inspect padding and mip behavior before increasing resolution.
Inspect successive mip levels and a checker-derived seam test.
Compare UV gutters, dilation and texture sampling before blaming geometry normals or adding resolution.

### Ray projection catches neighboring geometry

Adjust cage and isolate bake groups while preserving intended contacts.
Display cage rays around the contaminated region and temporarily hide neighboring high meshes.
Check cage topology/alignment and surface distance, keeping intended contact occlusion separate.

### Metal looks like painted plastic

Inspect metallic mask, base-color interpretation and environment lighting.
Use a simple metal/dielectric reference patch under known lighting.
Compare mask values, roughness, base color and environment reflections before adjusting exposure to conceal the issue.

### Procedural shader disappears on export

Check supported node patterns and bake required channels into images.
Export one image-driven Principled test material and inspect its channel connections.
Isolate unsupported procedural nodes and bake only their required surface information.

### Compressed texture loses critical masks

Compare channels and choose a target-supported encoding with measured quality.
Inspect decoded masks and normals, then compare an uncompressed variant under identical sampling.
Preserve critical alpha/roughness edges using a consumer-supported format rather than selecting only smallest bytes.

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

- [Blender baking](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html)
- [glTF materials](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)
- [KTX tools](https://github.com/KhronosGroup/KTX-Software)
- [PBR reference](https://www.khronos.org/gltf/pbr/)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
