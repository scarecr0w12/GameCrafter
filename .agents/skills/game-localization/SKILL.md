---
name: game-localization
description: "Prepare or implement localization for game text, dialogue, captions, fonts, layout, bidirectional UI, localized assets, locale selection, and translation testing. Use for multilingual game support; separate internationalization checks from human translation-quality review."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game localization

Create a repeatable multilingual content pipeline and prove representative UI/gameplay remains usable in selected locales.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Source language, target locales, content catalogs, and translation ownership.
- Engine/version, text runtime, UI layouts, fonts, subtitles, and localized assets.
- Placeholders, plural/context rules, locale fallback, and platform constraints.

## Procedure

### 1. Inventory content

- Find player-visible strings, dialogue, images, audio, and rendered numbers.
- Record dynamic strings and content generated outside the normal UI pipeline.

### 2. Choose identifiers and context

- Follow the project’s catalog/runtime conventions and stable identifiers.
- Attach speaker, purpose, length constraints, and placeholder explanations.

### 3. Separate text from logic

- Replace hardcoded presentation with the supported translation mechanism.
- Avoid string concatenation that prevents translators from controlling sentence order.

### 4. Implement locale behavior

- Respect supported locale selection and fallback with an in-game override.
- Persist the selection and define how changes update active screens and content.

### 5. Prepare fonts and layout

- Support required scripts and flexible controls with suitable fallback fonts.
- Inspect wrapping, truncation, scale, and fixed-size dialogue/caption regions.

### 6. Handle language structure

- Use the installed runtime’s plural, number, and bidirectional features where supported.
- Keep technical paths/identifiers stable and identify directional icons needing review.

### 7. Manage localized assets

- Map language-dependent textures, narration, and captions explicitly.
- Ensure fallback resources and packaging behavior are defined for missing assets.

### 8. Run pseudolocalization

- Use expansion and accented text to expose hardcoded content and layout assumptions.
- Do not treat this as adequate CJK or right-to-left validation.

### 9. Test actual locales

- Check selected scripts, mixed direction, placeholders, and runtime switching.
- Have fluent reviewers assess meaning and voice when available; label that gap otherwise.

### 10. Deliver a handoff and evidence

- Provide catalogs, context notes, font/asset mappings, and screenshots.
- Clear temporary test-locale overrides before committing unless they are intended configuration.

## Deliverables

- Editable string/asset inventory and translation context.
- Locale/fallback behavior and font/layout changes.
- Pseudolocale plus actual-locale evidence and linguistic-review gaps.

## Completion review

- Placeholders are preserved and substitutions stay grammatically usable.
- Representative CJK and RTL scenarios use actual required glyphs/direction.
- Fallback and locale switching work in an exported build.
- Temporary test locale does not override normal player selection accidentally.

## Gotchas

- Text expansion alone cannot test all scripts or directionality.
- Machine translation is a draft until meaning and voice are reviewed.
- Unsupported target fonts may appear fine on a developer workstation.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that GameCrafter has executed them.
Last researched: 2026-10-01.

- [Locale, fonts, resources, and direction](https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html).
- [Pseudolocalization capabilities and limits](https://docs.godotengine.org/en/stable/tutorials/i18n/pseudolocalization.html).
