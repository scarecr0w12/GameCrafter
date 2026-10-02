# Game localization: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Translate quest UI into German, Japanese, and Arabic.

**Initial investigation:** Inventory strings/context and inspect font/layout capabilities in the selected runtime.

**Proposed action:** Run pseudolocale, then actual script and direction examples in a packaged build.

**Expected handoff:** Catalog, screenshots, fallback tests, and explicitly pending fluent review.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Find catalog and placeholder defects | Expansion: No hidden untranslated text or critical clipping. |
| Test expansion, fonts, and direction | Script/direction: Actual-locale screenshots with font settings. |
| Exercise locale changes and asset fallback | Fallback: Defined fallback rather than broken content. |
| Review packaged language content and meaning | Switch/export: Current UI, persisted preference, packaged resources. |

## Detailed scenarios

### 1. Find catalog and placeholder defects

- Inventory main menu, quest title, inventory quantity, subtitle, loading hint, and error message from representative gameplay.

- Give a translator context for hypothetical QUEST_BRIDGE_TITLE and NPC_GUARD_014 rather than only isolated English text.

- Use example placeholders for player name and item count; compare catalog entries with runtime substitutions.

- Inspect concatenated fragments that prevent sentence reordering and locale-specific grammar.

- Run pseudolocalization and mark strings that remain unchanged; decide whether each is intended technical text or missed content.

- Deliver a string inventory with ownership, context, placeholder rules, and unlocalized locations.

### 2. Test expansion, fonts, and direction

- Run long German quest descriptions at minimum supported resolution and large text scale.

- Test actual Japanese glyphs using packaged fonts, not developer-machine fallback availability.

- Render Arabic mixed with a player name, punctuation, and numbers; inspect text direction and intended UI mirroring.

- Check arrows that represent navigation separately from icons depicting an inherently fixed world direction.

- If layout clips, inspect fixed widths, wrapping, anchors, and font metrics before abbreviating translated meaning.

- Keep locale/font/layout screenshots; pseudolocalization alone does not establish CJK coverage or RTL behavior.

### 3. Exercise locale changes and asset fallback

- Start in automatic language selection, choose an explicit supported locale, and verify it persists after restart.

- Switch while a quest journal and subtitle scene are active; define whether current content updates immediately or on re-entry.

- Request an unsupported locale and remove one translated narration/resource in a local fixture.

- Inspect the intended fallback text, font, image, and audio selection rather than allowing a broken or silent interface.

- Check missing keys are diagnosable without exposing internal identifiers as the player’s final message.

- Deliver runtime-switch and fallback state tables, plus recordings when asset selection has a temporal effect.

### 4. Review packaged language content and meaning

- Export a representative build containing selected catalogs, font data, subtitle timing, and localized resources.

- Launch outside the editor and developer font environment; check startup locale and the longest important screens.

- Clear any temporary test-locale override before the final artifact unless it is intentional project configuration.

- Ask fluent reviewers to inspect instructions, narrative tone, plural meaning, and culturally ambiguous images where available.

- Classify machine-generated translation as a draft and preserve source context so corrections remain maintainable.

- Report engineering checks and human linguistic review separately with specific pending languages or scenes.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Editable string/asset inventory and translation context.
- Locale/fallback behavior and font/layout changes.
- Pseudolocale plus actual-locale evidence and linguistic-review gaps.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Placeholders are preserved and substitutions stay grammatically usable.
- Representative CJK and RTL scenarios use actual required glyphs/direction.
- Fallback and locale switching work in an exported build.
- Temporary test locale does not override normal player selection accidentally.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Locale, fonts, resources, and direction](https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html).
- [Pseudolocalization capabilities and limits](https://docs.godotengine.org/en/stable/tutorials/i18n/pseudolocalization.html).
