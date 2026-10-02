# Game asset authoring and validation workflows

**Last researched:** 2026-10-01

## Purpose

This note supports detailed game-asset skills for the complete asset workflow described in [Skills, agents and tools](../SKILLS_AGENTS_AND_TOOLS.md).
It distinguishes authoring concepts, interchange conformance, target-engine behavior and production acceptance.
The procedures recommended here are original project guidance; this note is not evidence of implemented GameCrafter connectors or live-tested assets.

## Source verification and versions

The Khronos specification, validator, sample viewer, sample assets and KTX repository were opened in this pass. [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [validator](https://github.com/KhronosGroup/glTF-Validator), [viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer), [samples](https://github.com/KhronosGroup/glTF-Sample-Assets), [KTX](https://github.com/KhronosGroup/KTX-Software).
Aseprite CLI, Audacity loudness guidance and Godot stable audio/particle properties were opened. [Aseprite](https://www.aseprite.org/docs/cli/), [Audacity](https://manual.audacityteam.org/man/loudness_normalization.html), [Godot audio](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html), [particles](https://docs.godotengine.org/en/stable/tutorials/3d/particles/properties.html).
English Blender pages returned 402 through the web tool and 403 through direct HTTP in this session; full-page Blender verification was blocked (unverified). [Blender 4.5 exporter](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html).
Indexed official 4.5 translated/UATEST pages exposed relevant content, but their full-page fetches also failed; detailed Blender claims below remain unverified until checked against installed documentation. [Translated exporter](https://docs.blender.org/manual/sl/4.5/addons/import_export/scene_gltf2.html), [UATEST baking](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html), [UATEST UV editing](https://docs.blender.org/UATEST/manual/en/4.5/modeling/meshes/uv/editing.html).
Older weight-editing and development animation documentation were indexed rather than confirmed against a locally installed Blender version (unverified). [Blender 2.80 weights](https://docs.blender.org/manual/en/2.80/sculpt_paint/weight_paint/editing.html), [development Bake Action](https://docs.blender.org/manual/en/dev/editors/nla/editing/strip.html).

## Editable models, UVs and baking

Blender Poly Build is described as useful for retopology (full-page verification blocked; unverified). [Poly Build](https://docs.blender.org/manual/en/4.5/modeling/meshes/tools/poly_build.html).
The indexed UV guidance describes packing margins and averaging island scale (unverified). [UV editing](https://docs.blender.org/UATEST/manual/en/4.5/modeling/meshes/uv/editing.html).
Indexed bake guidance requires UVs and an active destination image/color attribute; selected-to-active projection depends on ray/cage setup (unverified). [Render baking](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html).
The same guidance describes padding around islands for filtered/mipped textures (unverified). [Render baking](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html).

Recommended project procedure:

- Preserve sculpt/procedural/native source and create a separate export variant.
- Review silhouette and dimensions before adding detail.
- Allocate topology by curvature, deformation and camera importance.
- Inspect normals, degenerate geometry and intentional open boundaries.
- Check UV stretch with a diagnostic texture and explain intentional overlap.
- Decide texture density and padding from the selected presentation and importer.
- Test a small bake before spending time on final resolution.
- Inspect output images, save them and test dependency loading from a clean location.
- Treat collision meshes and LOD variants as separate gameplay/rendering deliverables.

## glTF interchange and consumer checks

The glTF specification defines scene geometry, materials, skins and animation data, coordinate conventions and extension declarations. [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
Khronos provides a validator for asset conformance; its report documents structural checks rather than gameplay suitability. [Validator](https://github.com/KhronosGroup/glTF-Validator).
The sample viewer supports asset loading, lighting/tone-mapping control, animation selection, debug channels, validation and statistics. [Sample Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer).
Sample assets demonstrate format capabilities and include model-specific license/credit information. [Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets).
KTX-Software supplies KTX texture tools; format choice still requires consumer capability checks. [KTX-Software](https://github.com/KhronosGroup/KTX-Software).
Indexed Blender exporter guidance states that UV/normal discontinuities can split exported vertices and that meshes are triangulated (unverified). [Blender exporter](https://docs.blender.org/manual/sl/4.5/addons/import_export/scene_gltf2.html).
Its indexed animation guidance states that Blender 4.4 action slots changed default merging behavior (unverified). [Blender exporter](https://docs.blender.org/manual/sl/4.5/addons/import_export/scene_gltf2.html).

Recommended project procedure:

- Inspect target importer/version before selecting format or compression extensions.
- Record units, axis conversion, pivot and expected dimensions.
- Validate the current payload, preserving complete reports and reviewing warnings.
- Compare source and exported counts; avoid budgeting only from source polygon counts.
- Inspect in an independent viewer, then import into the actual selected engine.
- Test collision, deformation, root motion and LOD behavior where relevant.
- Measure target resource cost under representative simultaneous instances.

## Sprite atlases and visual direction

Aseprite CLI supports batch export to image plus JSON metadata, tags/frame ranges, trim options, padding and extrusion. [Aseprite CLI](https://www.aseprite.org/docs/cli/).
The same CLI documentation describes order-sensitive options such as splitting layers before loading the relevant file. [Aseprite CLI](https://www.aseprite.org/docs/cli/).

Recommended project procedure:

- Establish logical canvas, palette, silhouette and fixed anchor before frame production.
- Keep source layers, animation tags and timings editable.
- Review frames at gameplay size and play them against a fixed origin.
- Preserve source rectangles/offsets when trimming; test for animation jitter.
- Test atlas edges under actual filtering and zoom levels.
- Compare visual families with shared camera, lighting, exposure and background.
- Distinguish annotated art references, generated candidates, paintovers and direct engine captures.

## Rigging and animation

Older Blender guidance describes weight normalization and limiting influences (installed-version verification required; unverified). [Weight editing](https://docs.blender.org/manual/en/2.80/sculpt_paint/weight_paint/editing.html).
Development Bake Action guidance describes visual keying of evaluated transforms (installed-version verification required; unverified). [Bake Action](https://docs.blender.org/manual/en/dev/editors/nla/editing/strip.html).

Recommended project procedure:

- Agree skeleton, rest pose, root-motion and influence contracts before binding.
- Test articulation extremes and contact before polishing all clips.
- Preserve authoring constraints and bake only an export copy when needed.
- Export one diagnostic clip and verify actual clip names/ranges and deformation.
- Check loop boundaries, transitions and root displacement in the selected engine.

## Audio and VFX

Godot audio import distinguishes WAV sample-based loop bounds from Ogg/MP3 second-based loop offsets; looping streams do not emit end-of-stream `finished` on each wrap. [Audio import](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html).
Audacity distinguishes perceived-loudness normalization from peak adjustment, with settings affecting stereo balance and mono measurement. [Loudness normalization](https://manual.audacityteam.org/man/loudness_normalization.html).
Godot particle properties include visibility bounds, local coordinates, lifetime and simulation frequency; low update frequency can permit collision tunneling. [Particle properties](https://docs.godotengine.org/en/stable/tutorials/3d/particles/properties.html).

Recommended project procedure:

- Keep audio masters and runtime encodings separate; choose mix targets by sound role.
- Listen to repeated loop boundaries after encoding and actual import.
- Test spatialization, concurrent voices, buses and lifecycle behavior together.
- Define effect anticipation/impact/recovery timing and gameplay readability.
- Inspect transparent edges, culling bounds and moving-emitter behavior.
- Profile simultaneous effects and correct the measured bottleneck.

## Evidence and design implications

Recommended evidence gates are independent: art study, editable source, checked export, checked import, exercised behavior and measured budget.
Use exact artifact paths, tool versions and pass/fail/not-run records.
A provider job submission, preview render, conformance report or successful import should not imply the other gates passed.
Skills should remain cross-engine and use the selected consumer's contracts instead of copying one engine's options into every workflow.
The new guidance does not change confirmed requirements or claim existing live integrations.

## Sources

- [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Khronos validator](https://github.com/KhronosGroup/glTF-Validator)
- [Khronos viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer)
- [Khronos sample assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
- [KTX-Software](https://github.com/KhronosGroup/KTX-Software)
- [Aseprite CLI](https://www.aseprite.org/docs/cli/)
- [Godot audio import](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html)
- [Godot particle properties](https://docs.godotengine.org/en/stable/tutorials/3d/particles/properties.html)
- [Audacity loudness normalization](https://manual.audacityteam.org/man/loudness_normalization.html)
- [Blender exporter](https://docs.blender.org/manual/sl/4.5/addons/import_export/scene_gltf2.html)
- [Blender baking](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html)
- [Blender UV editing](https://docs.blender.org/UATEST/manual/en/4.5/modeling/meshes/uv/editing.html)
- [Blender Poly Build](https://docs.blender.org/manual/en/4.5/modeling/meshes/tools/poly_build.html)
- [Blender weight editing](https://docs.blender.org/manual/en/2.80/sculpt_paint/weight_paint/editing.html)
- [Blender development Bake Action](https://docs.blender.org/manual/en/dev/editors/nla/editing/strip.html)
