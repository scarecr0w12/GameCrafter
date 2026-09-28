---
name: gamecrafter-research-note
description: Write or refresh a sourced research note under docs/research/ for the Game Development Platform (engine CLIs, MCP servers, DCC tools, sandboxing, model providers, agent standards). Use when gathering external facts before a design decision, or when a note's "Last researched" date is stale.
license: MIT
metadata:
  author: gamedev-platform
  version: "1.0"
---

# Writing a research note

Research notes are the evidence layer under the design documents. Design documents may only promote a fact that a research note sources.

## Required structure

```markdown
# <Topic>

**Last researched:** YYYY-MM-DD

## Purpose
One paragraph: what design question this informs, linking the design section.

## <Sections by tool / option / vendor>
- Bullet facts. Every factual bullet ends with a Markdown link to its source.
- Anything you could not open or confirm: append "(unverified)".

## Implications for our design   (or "Recommended approach and caveats")
Short, decision-relevant bullets.

## Sources
- One link per line, deduplicated.
```

Length target: 80–200 lines. Split by topic rather than exceed it.

## Procedure

1. Read the design section the note informs so you know which facts matter.
2. Prefer primary sources: vendor docs, spec pages, repository READMEs/manuals. Use `webfetch` on the page; do not rely on search snippets alone. If fetching is blocked, mark the fact "(unverified)".
3. For open-source projects record: URL, language, how it connects (stdio/HTTP/socket/addon), what it exposes, license, and last activity date **only if you actually saw it** — otherwise "not verified in this pass".
4. For APIs record: auth scheme, job lifecycle, output formats, rate-limit/pricing page link, license/provenance fields (or state that none were found).
5. For OS/security mechanisms: what it restricts (fs/network/process), unprivileged availability, known deployments. Never write "secure" or "proven".
6. Write the note, then add a `**Status:**` pointer from the relevant `OPEN_DECISIONS.md` entry to the note (see `gamecrafter-design-docs`).

## Gotchas

- MCP is at revision 2026-07-28 (stateless, no `initialize`); many community servers implement 2025-era revisions. Note which revision a server targets when visible.
- Vendor "AI/MCP" features move fast (Unity deprecated its AI Assistant MCP in favor of `unity mcp`; Epic ships an Editor MCP plugin in 5.8). Re-verify before promoting to design text.
- skills.sh's API is Vercel-OIDC-only; do not describe it as publicly callable.
- Do not add marketing claims or benchmark numbers as measured facts.
