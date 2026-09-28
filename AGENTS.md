# AGENTS.md

Instructions for coding agents working in this repository.

## What this repository is

A design repository for a locally run, open-source game development platform (Theia-based desktop Control Room, local Node/TypeScript platform service, multi-agent swarm, installable plugins and skills, CLI/MCP connectors to Unity, Unreal, Godot, and DCC tools). There is no application code yet; the deliverables are the Markdown documents under `docs/`.

## Document roles

- `docs/PLATFORM_DESIGN.md`: user-confirmed requirements, proposed architecture, decision log. Only the user confirms entries in "Confirmed requirements and decisions" and the decision log's "Confirmed" rows.
- `docs/TECHNICAL_ARCHITECTURE.md`: selected engineering defaults for the stack. May be updated under delegated best-practice judgment.
- `docs/SKILLS_AGENTS_AND_TOOLS.md`: contracts for skills, agent roles, MCP connections, connectors, and isolation direction.
- `docs/OPEN_DECISIONS.md`: decision register. When a decision is settled, change its status in place and link the resolving section; do not delete entries.
- `docs/research/*.md`: sourced reference notes. Every factual claim needs a source URL; mark anything unverified as "unverified". Include a "Last researched" date.

## Conventions

- Preserve the distinction between user-confirmed requirements and selected engineering defaults in every document.
- No phases, milestones, or roadmaps: documents describe the complete target system by architectural area.
- Present complete recommendations instead of asking serial approval questions; bring only genuine product/creative decisions to the user.
- Do not describe anything as implemented, tested, or secure unless it has been; label proposals as proposals.
- External standards adopted: Agent Skills (`SKILL.md`) for skills, `AGENTS.md` for repository instructions, MCP for tool connections. Do not invent parallel formats.
- Working name prefix for platform-specific metadata is `gdp-`; it changes when decision P01 (name) is resolved.

## Verification

- There is no build or test suite. Verify documentation changes by checking that relative links resolve and that new decisions are reflected consistently across the design, architecture, and decision register.
- Research notes older than a few months should be re-verified before a claim from them is promoted into a design document.

## Agent tooling in this repository

- Project skills live in `.agents/skills/` (read by Devin, Codex, and other `.agents`-aware tools). First-party: `gdp-design-docs`, `gdp-research-note`, `theia-app-dev`, `mcp-multiversion-client`. Third-party skills are installed with `npx skills add <owner/repo> --skill <name> -a codex --copy -y`; review a skill's `SKILL.md` before installing and keep `skills-lock.json` current.
- Devin custom subagent profiles live in `.agents/agents/`: `design-reviewer` (read-only doc consistency review), `research-verifier` (re-checks research notes against sources), `theia-implementer` (scoped implementation with tests).
- Run `scripts/check-links.sh` after any documentation change.
- Use `/gdp-design-docs` when editing design documents and `/gdp-research-note` when adding research; use `/skill-creator` to author new project skills and keep them under 500 lines.
## Agent tooling in this repository

- Project skills live in `.agents/skills/` (read by Devin, Codex, and other `.agents`-aware tools). First-party: `gdp-design-docs`, `gdp-research-note`, `theia-app-dev`, `mcp-multiversion-client`. Third-party skills are installed with `npx skills add <owner/repo> --skill <name> -a codex --copy -y`; review a skill's `SKILL.md` before installing and keep `skills-lock.json` current.
- Devin custom subagent profiles live in `.agents/agents/`: `design-reviewer` (read-only doc consistency review), `research-verifier` (re-checks research notes against sources), `theia-implementer` (scoped implementation with tests).
- Run `scripts/check-links.sh` after any documentation change.
- Use `/gdp-design-docs` when editing design documents and `/gdp-research-note` when adding research; use `/skill-creator` to author new project skills and keep them under 500 lines.
