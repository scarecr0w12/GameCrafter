---
name: gamecrafter-design-docs
description: Edit or extend the Game Development Platform design documents in docs/ (PLATFORM_DESIGN, TECHNICAL_ARCHITECTURE, SKILLS_AGENTS_AND_TOOLS, OPEN_DECISIONS). Use when recording a decision, resolving a decision-register entry, adding an architectural proposal, or checking cross-document consistency in this repository.
license: MIT
metadata:
  author: gamedev-platform
  version: "1.0"
---

# Working on the platform design documents

The design documents under `docs/` are the specification the code in `packages/` and `apps/` implements. Consistency between them is the quality bar; the code may only be described as implementing a section once that behaviour is covered by tests in this repository.

## Document roles (never blur these)

| File | Owns | Who may change status |
| --- | --- | --- |
| `docs/PLATFORM_DESIGN.md` | User-confirmed requirements, proposed architecture, decision log | Only the user confirms "Confirmed" rows and "Confirmed requirements" bullets |
| `docs/TECHNICAL_ARCHITECTURE.md` | Selected engineering defaults for the stack | Agent may update under delegated judgment |
| `docs/SKILLS_AGENTS_AND_TOOLS.md` | Skill/role/MCP/connector contracts | Agent may update |
| `docs/OPEN_DECISIONS.md` | Decision register (IDs like A03, S02, C04) | Agent updates `**Status:**` in place; never delete an entry |
| `docs/research/*.md` | Sourced reference notes | Use the `gamecrafter-research-note` skill |

## Procedure: record a decision

1. Classify it: **Confirmed** (user said so in conversation), **Engineering default** (delegated best-practice judgment), or **Verify** (clear intent, needs real-software proof).
2. Write the substantive text in the owning document section (architecture or contracts), not in the register.
3. In `OPEN_DECISIONS.md`, find the entry ID and append `**Status:** …` as the last sentence of that paragraph, linking the resolving section with a GitHub-style anchor (`#24-catalog-selection-and-loading-…`). Keep the entry; do not rewrite its original text.
4. If the decision is user-confirmed, add a row to the PLATFORM_DESIGN decision log with Status `Confirmed` and Source `User discussion`. If it is an engineering default, use Status `Engineering default` and Source = the document filename.
5. If an item in PLATFORM_DESIGN's "Engineering details to resolve" list is now answered, remove that bullet.
6. Run the link check (below).

## Procedure: add a proposal

- Put it under "Proposed architecture for discussion" in PLATFORM_DESIGN as a numbered item, or as a new section in the contracts document. Start with "Proposed" or "Recommended" wording; never "the platform does".
- Add corresponding open entries to the register if it creates new unresolved choices (next free ID in the right section).

## Style rules

- No phases, milestones, roadmaps, "first game", or "MVP" language. Sections are architectural areas.
- Present complete recommendations; do not add lists of questions for the user unless genuinely product/creative.
- Never state something is implemented, tested, or secure. Write "candidate", "selected direction", "remains Verify".
- Prefix for platform-specific metadata keys is `gamecrafter-` (retained compatibility identity; the public product name is PlayWeld, see `docs/BRANDING.md`).
- Dependency ordering between work packages belongs only in `docs/DEVELOPMENT_PLAN.md`; when a work package lands, update its "Status" there and the register entries it resolves.
- Keep `**Last updated:**` current in any header you touch (format `YYYY-MM-DD`).

## Link check (run after edits)

```bash
scripts/check-links.sh
```

It resolves every relative Markdown link and anchor in `docs/**/*.md`, `README.md`, and `AGENTS.md`. Fix anchors, not headings.

## Gotchas

- Anchor slugs: lowercase, spaces to hyphens, punctuation stripped, `§` stripped; `2.4 Catalog, selection, and loading (resolves A03/S08 for skills)` becomes `#24-catalog-selection-and-loading-resolves-a03s08-for-skills`.
- The decision log table in PLATFORM_DESIGN has three columns; the option-evaluation table has a stray separator row (`| --- | --- | --- |` for two columns) — leave it, it is historical.
- `OPEN_DECISIONS.md` entries are single paragraphs; a `**Status:**` sentence belongs inside the same paragraph, one space after the previous sentence.
