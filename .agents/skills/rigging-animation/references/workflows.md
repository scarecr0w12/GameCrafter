# Rigging and animation: detailed workflows

**Source review date:** 2026-10-01.
This reference contains original GameCrafter recommendations rather than copied vendor procedures.
Examples describe work to perform, not assets or integrations already tested in this repository.
Use project budgets and creative direction; the numbers and tooling must come from actual task context.

## Example 1: Walk cycle delivery

Requested result: Deliver a looping walk with both in-place and motion variants.

Recommended approach: Define speed and root contract; test contact; export both deliberately; compare displacement and clip length in engine.

Expected delivery: Deliver clip table and contact/root-motion evidence.

Review gates:

- Record clip duration, sampling rate, start/end range and whether end pose is held or wraps into the first frame.
- Produce in-place and displacement variants from the same source action with a named root-motion policy.
- Compare first/last root transforms and foot contacts; include rotation as well as translation when measuring displacement.
- Inspect exported clip names and ranges, checking that unrelated authoring actions were not included.
- Run each variant with the matching gameplay movement mode so displacement is applied once.
- Deliver a clip table including speed, loop policy and observed foot contact, plus imported skeleton/rest-pose evidence.

## Example 2: IK export

Requested result: An animator uses constraints that the interchange importer cannot reproduce.

Recommended approach: Keep the rig; bake evaluated transforms on an export copy; verify sampled motion against original; export and compare.

Expected delivery: Deliver rig, baked clip and visual comparison.

Review gates:

- Duplicate the authoring rig and capture reference poses before baking or removing constraints.
- Choose evaluated/visual transforms for the intended bones; record frame range, step and pose/object channels.
- Compare sampled bone transforms against the original at intermediate frames as well as keyframe times.
- Check that nondeforming controls are excluded only when their hierarchy is unnecessary to the final motion.
- Export a diagnostic action and inspect bind/rest pose, clip inventory and importer-generated tracks.
- Deliver original rig, baked export copy and a list of constraints/drivers no longer required at runtime.

## Example 3: Generated character rig review

Requested result: A generated humanoid arrives with automatic weights.

Recommended approach: Inspect skeleton and rest pose; enforce target influence contract; test joint extremes; repair failures; export one diagnostic clip.

Expected delivery: Deliver exact repairs and untested retargeting limitations.

Review gates:

- Inventory deform bones, root hierarchy, rest pose and the intended destination skeleton mapping.
- Inspect unweighted vertices and influences per vertex; limit/normalize using the selected consumer's contract.
- Test shoulder twist, hip flexion, knee bend and hand poses with wireframe visible.
- Distinguish weight errors from inadequate topology or misplaced joints before repainting repeatedly.
- Export one diagnostic pose sequence and compare imported joint transforms and deformed silhouette.
- Deliver repaired weight/topology areas and separate untested retargeting, additive layers and blend transitions.

## Failure diagnosis

### Rest pose changes on import

Compare bind matrices, armature transforms and importer conversion settings.
Compare the mesh rest state, joint rest transforms and inverse-bind data before playing animation.
Check importer axis conversion and inherited scale before changing animation keys.

### More clips export than intended

Inspect action slots, active actions, NLA tracks and exporter mode.
List actual exported animations and their durations; compare action slots, active actions and NLA exporter mode.
Remove one source action on a copy to identify the inclusion rule.

### Constraint-driven animation becomes static

Bake evaluated motion on an export copy and confirm sampled keys.
Compare evaluated bone transforms with keyed values at an intermediate frame.
Bake a short range first; confirm constraints are included rather than merely copying original F-curves.

### Foot slides despite correct looking poses

Compare root displacement, clip speed and actual character movement.
Measure root translation per cycle and compare it with gameplay distance at the same clip duration.
Check playback-rate scaling and contact timing before editing foot poses.

### Loop has a visible pop

Compare end/start transforms and avoid an accidental duplicated boundary hold.
Compare first/last root and key-joint transforms, including rotation and scale.
Inspect whether a duplicated boundary frame causes a hold or whether interpolation introduces an unobserved discontinuity.

### Shoulder collapses at extremes

Review topology, joint placement and weights before adding corrective shapes.
Test the same pose with weights isolated and inspect joint placement.
Add or redirect topology only where volume/contour needs it; evaluate corrective shapes separately from basic skinning.

### Retargeted limbs rotate incorrectly

Compare rest pose, bone orientation and mapping rather than renaming blindly.
Compare source/target rest-pose axes and limb lengths using a diagnostic neutral pose.
Verify bone mapping and retarget offsets before assuming identical names imply compatible orientation.

### Root movement applies twice

Identify whether animation or gameplay movement owns displacement.
Run the clip once with gameplay translation disabled and once with extracted root motion disabled.
Confirm which component supplies position/rotation and remove the duplicate authority.

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

- [Blender weights, older manual](https://docs.blender.org/manual/en/2.80/sculpt_paint/weight_paint/editing.html)
- [Bake Action, development manual](https://docs.blender.org/manual/en/dev/editors/nla/editing/strip.html)
- [Blender 4.5 glTF animation](https://docs.blender.org/manual/sl/4.5/addons/import_export/scene_gltf2.html)
- [glTF skinning and animation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

## Source applicability

Prefer documentation matching the installed version and selected target engine.
The source links support tool concepts; the procedural choices above remain project recommendations.
Blender English-page fetches returned 402 through the web tool and 403 through direct HTTP in this research pass.
Blender indexed 4.5 translated/UATEST content was visible, but full-page retrieval was blocked: detailed claims remain unverified here.
The weight reference is Blender 2.80 and the Bake Action reference is development documentation where included.
Confirm those concepts against the installed version before issuing commands or choosing export options.
Godot examples illustrate a target-specific consumer; do not transfer its options verbatim to Unity or Unreal.
Use vendor documents plus direct inspection to resolve a disagreement between source and installed behavior.
