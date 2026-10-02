# Game accessibility: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** A boss attack is signaled only by a red flash and a sound.

**Initial investigation:** Map how players identify the attack and how much response time they receive.

**Proposed action:** Add a readable shape/animation cue and configurable audio/visual presentation.

**Expected handoff:** Before/after scenario evidence and relevant player feedback gaps.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Remove demanding input barriers | Input: Binding/focus behavior with supported device. |
| Make essential cues available through alternatives | Information: Alternative cue remains useful. |
| Check text, captions, and focus | Text/captions: Readable text, attribution, and no clipping. |
| Verify settings persistence and player feedback | Persistence: Preferences and effects retained. |

## Detailed scenarios

### 1. Remove demanding input barriers

- Inspect a mechanic requiring hold-to-aim plus repeated attack presses; document the intended skill being tested.

- Try toggle aim, remapped attack, and an appropriate repeat/hold alternative using supported devices.

- Navigate to the settings from first launch without the input pattern being changed; settings access itself must be usable.

- Check that remapping updates prompts and does not leave inaccessible conflicts or reserved actions undocumented.

- If an alternative affects competitive timing, explain the practical effect and route policy choices to the user.

- Keep device, bindings, menu path, and gameplay recordings; a settings screenshot proves presence only.

### 2. Make essential cues available through alternatives

- Use a boss warning currently communicated by a red flash and sound, then test with audio disabled.

- Add a distinct readable shape or animation and inspect it against representative bright and dark scene backgrounds.

- Test a second condition where the player cannot distinguish the original colors; inspect form and timing rather than filter appearance alone.

- Check priority when several warnings occur together so added cues do not obscure the essential response.

- Preserve intended reaction time and mechanic difficulty unless the user authorizes a design change.

- Save encounter captures showing each available cue configuration and explicitly identify affected-player feedback still missing.

### 3. Check text, captions, and focus

- Run menus at the lowest supported resolution with large text enabled and inspect long labels and nested dialogs.

- Use controller or keyboard digital navigation through disabled controls, submenus, confirmation, and back/cancel.

- Check visible focus, programmatic order where available, and restoration after a dialog closes.

- Play a dialogue scene with overlapping speakers and essential off-screen sound; inspect attribution and caption sequencing.

- When captions overflow, examine content duration, wrapping, display region, and font size before deleting useful information.

- Keep screenshots and timed recordings; static text inspection alone cannot validate caption timing or focus movement.

### 4. Verify settings persistence and player feedback

- Enable reduced camera motion, remapped controls, and captions, then restart the game and enter another supported mode.

- Check the saved preference and actual effect separately, including cutscenes and scripted camera transitions.

- Restore defaults and verify the menu explains effects clearly without requiring technical implementation knowledge.

- Invite affected players to relevant scenarios when available; record access needs and feedback without claiming representation of everyone.

- Classify barriers that remain fundamental to the mechanic separately from missing alternatives or implementation defects.

- Deliver guideline mappings, observed changes, remaining barriers, and the difference between agent checks and participant evidence.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Barrier inventory mapped to applicable guidelines.
- Implemented options/alternatives and preference persistence checks.
- Scenario evidence, remaining barriers, and player-testing gaps.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Essential information has an available usable alternative channel.
- Supported input methods can reach and operate accessibility settings.
- Options work after restart and in a representative gameplay scenario.
- Claims distinguish automatic checks, agent interaction, and affected-player feedback.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Guideline scope and limitations](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines).
- [Input demands and alternatives](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107).
