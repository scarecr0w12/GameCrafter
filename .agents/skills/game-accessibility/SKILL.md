---
name: game-accessibility
description: "Review or implement game accessibility for input, text, subtitles, audio/visual cues, navigation, difficulty, motion, timing, or player communication. Use when reducing player barriers; deliver scoped changes and evidence without claiming universal accessibility or legal compliance."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game accessibility

Remove identified player barriers through practical options and testable interaction alternatives.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Game mechanics, input methods, UI surfaces, target platforms, and intended challenge.
- Known player barriers, existing settings, and available participant feedback.
- Current text/audio/caption assets and persistence behavior for preferences.

## Procedure

### 1. Scope by actual barriers

- Inventory required actions and information needed to play.
- Choose relevant XAG sections rather than applying every feature to every game.

### 2. Inspect input demands

- Identify holds, repeats, simultaneous inputs, precision, and timing requirements.
- Offer remapping and suitable alternatives while preserving the intended mechanic.

### 3. Inspect information channels

- Find cues conveyed by only color, sound, motion, or vibration.
- Add compatible visual/audio/text alternatives with understandable priority.

### 4. Inspect text and captions

- Check readable sizing, contrast, speaker identification, and timing.
- Include essential non-speech information where it matters to gameplay.

### 5. Inspect menus and focus

- Navigate settings and gameplay menus using supported digital inputs.
- Check focus order, escape/back behavior, disabled controls, and error recovery.

### 6. Inspect motion and timing

- Review camera shake, flashes, blur, timed UI, and forced input sequences.
- Add applicable options and explain their effects using player-facing language.

### 7. Inspect challenge options

- Separate independent difficulty variables where useful.
- Explain assist effects and preserve existing choices without silently changing progression.

### 8. Persist and expose settings

- Verify preferences survive restart and apply consistently across modes.
- Make accessibility options discoverable before a barrier prevents reaching them.

### 9. Validate representative scenarios

- Run the actual controls, captions, and option combinations on target surfaces.
- Collect feedback from affected players where available and state participant gaps.

### 10. Deliver barrier evidence

- Pair each finding with affected scenario, change, and result.
- Describe this as guideline-informed review; XAG is not a legal compliance checklist.

## Deliverables

- Barrier inventory mapped to applicable guidelines.
- Implemented options/alternatives and preference persistence checks.
- Scenario evidence, remaining barriers, and player-testing gaps.

## Completion review

- Essential information has an available usable alternative channel.
- Supported input methods can reach and operate accessibility settings.
- Options work after restart and in a representative gameplay scenario.
- Claims distinguish automatic checks, agent interaction, and affected-player feedback.

## Gotchas

- One disability simulation cannot represent affected players’ experiences.
- A settings menu can contain a barrier even when gameplay is adjustable.
- Caption presence alone does not establish adequate readability or timing.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that GameCrafter has executed them.
Last researched: 2026-10-01.

- [Guideline scope and limitations](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines).
- [Input demands and alternatives](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107).
