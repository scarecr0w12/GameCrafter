# AGENTS.md

Instructions for coding agents working in this repository.

## What this repository is

The monorepo for **PlayWeld**, a free, open-source, locally run game development platform: a Theia-based desktop Control Room, a local Node/TypeScript platform service, a multi-agent swarm, installable plugins and skills, and CLI/MCP connectors to Unity, Unreal, Godot, and DCC tools. Licensed under Apache-2.0 (`LICENSE`, `NOTICE`).

It holds both the design documents (`docs/`) and the application code (`packages/`, `apps/`). The design documents describe the complete target system; the code implements it work package by work package as listed in `docs/DEVELOPMENT_PLAN.md`.

## Layout

- `docs/`: design documents, decision register, development plan, research notes (roles below).
- `packages/contracts`: `@gamecrafter/contracts`: TypeBox schemas, derived TypeScript types, RPC method table, error codes. Every persisted record and RPC message carries a `schemaVersion`.
- `packages/platform-service`: `@gamecrafter/platform-service`: the local daemon (authenticated JSON-RPC over a Unix socket / named pipe, global profile SQLite, Project workspaces). Binary `gamecrafter-service start|stop|status`.
- `packages/service-client`: `@gamecrafter/service-client`: typed client used by the Theia backend and by tests.
- `packages/theia-control-room`: Theia extension (backend bridge to the service, Control Room views).
- `apps/control-room`: the Theia Electron application (desktop-only product target). `apps/control-room-browser` is a development-only browser target used for UI smoke tests.
- `.agents/`: project skills and subagent profiles. `scripts/`: repository maintenance scripts.

## Document roles

- `docs/PLATFORM_DESIGN.md`: user-confirmed requirements, proposed architecture, decision log. Only the user confirms entries in "Confirmed requirements and decisions" and the decision log's "Confirmed" rows.
- `docs/TECHNICAL_ARCHITECTURE.md`: selected engineering defaults for the stack. May be updated under delegated best-practice judgment.
- `docs/SKILLS_AGENTS_AND_TOOLS.md`: contracts for skills, agent roles, MCP connections, connectors, and isolation direction.
- `docs/OPEN_DECISIONS.md`: decision register. When a decision is settled, change its status in place and link the resolving section; do not delete entries.
- `docs/DEVELOPMENT_PLAN.md`: work packages ordered by technical dependency, each mapped to design sections and register entries, with "done when" criteria. This is the only document allowed to express ordering, and the ordering is dependency, not product phasing.
- `docs/STATUS.md`: summary of what exists, its evidence level (fake-tested vs. live-verified), and remaining work grouped by area. Update it in the same change that changes a work-package status or resolves a register entry; the plan remains the authoritative per-package status text.
- `docs/research/*.md`: sourced reference notes. Every factual claim needs a source URL; mark anything unverified as "unverified". Include a "Last researched" date.

## Public identity

The public product name is **PlayWeld**, and the user owns `playweld.com`. Preserve existing GameCrafter technical identifiers, package names, data paths, app ID, and GitHub URLs for compatibility; see `docs/BRANDING.md`. Do not rename these through a blanket text replacement.

## Conventions

- Preserve the distinction between user-confirmed requirements and selected engineering defaults in every document.
- No phases, milestones, or roadmaps in the design documents: they describe the complete target system by architectural area. Dependency ordering lives only in `docs/DEVELOPMENT_PLAN.md`.
- Present complete recommendations instead of asking serial approval questions; bring only genuine product/creative decisions to the user.
- Do not describe anything as implemented, tested, or secure unless it has been in this repository; label proposals as proposals. "Unit-tested" and "tested against a live engine/DCC/MCP server" are different claims.
- External standards adopted: Agent Skills (`SKILL.md`) for skills, `AGENTS.md` for repository instructions, MCP for tool connections. Do not invent parallel formats.
- Platform-specific metadata prefix is `gamecrafter-` (skill frontmatter `metadata` keys, Project folder `.gamecrafter/`, npm scope `@gamecrafter/*`).
- Code: TypeScript strict, CommonJS output, npm workspaces (no yarn or pnpm anywhere in the tree), Turborepo for task orchestration, Vitest for tests. Durable state (tasks, board, Project records, router learning) lives in the platform service and its contracts, never in Theia frontend/backend code or plugins.
- Dependencies: pin exact versions and prefer releases published at least 7 days ago (`npm view <pkg> time`). Theia packages are pinned to one exact version across all packages.
- SQLite access goes through `packages/platform-service/src/db/database.ts` only (the `node:sqlite` seam).

## Verification

- Code: `npm ci`, then `npx turbo run build typecheck lint test`. Run the narrowest package test while iterating (`npm test -w @gamecrafter/contracts`), the full turbo run once before finishing. `npm run format:check` must be clean.
- Theia app: `npm run build -w @gamecrafter/control-room` (Electron) and `npm run start -w @gamecrafter/control-room-browser` for a browser smoke test on `http://localhost:3000`.
- Documentation: run `scripts/check-links.sh` after any documentation change and check that new decisions are reflected consistently across the design, architecture, decision register, and development plan.
- Research notes older than a few months should be re-verified before a claim from them is promoted into a design document.

## Agent tooling in this repository

- Project skills live in `.agents/skills/` (read by Devin, Codex, and other `.agents`-aware tools). First-party: `gamecrafter-design-docs`, `gamecrafter-research-note`, `theia-app-dev`, `mcp-multiversion-client`. Third-party skills are installed with `npx skills add <owner/repo> --skill <name> -a codex --copy -y`; review a skill's `SKILL.md` before installing and keep `skills-lock.json` current.
- Devin custom subagent profiles live in `.agents/agents/`: `design-reviewer` (read-only doc consistency review), `research-verifier` (re-checks research notes against sources), `theia-implementer` (scoped implementation with tests).
- Use `/gamecrafter-design-docs` when editing design documents, `/gamecrafter-research-note` when adding research, `/theia-app-dev` for Theia work, `/mcp-multiversion-client` for MCP client work; use `/skill-creator` to author new project skills and keep them under 500 lines.
