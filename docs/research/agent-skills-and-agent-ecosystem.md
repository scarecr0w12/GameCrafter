# Agent Skills, Skill Distribution, Agent Definitions, Theia AI, and MCP

**Last researched:** 2026-09-27

## Purpose

Record the external standards and ecosystems that the platform's installable skills, agent roles, and tool connections should align with, so the platform interoperates with the wider agent ecosystem instead of inventing parallel formats. The design requires installable skills selected dynamically with lazy loading ([platform design](../PLATFORM_DESIGN.md#projects-and-game-knowledge)) and a unified plugin system covering agent roles and skills ([technical architecture](../TECHNICAL_ARCHITECTURE.md#plugin-and-connector-contract)).

## Agent Skills open standard (agentskills.io)

The Agent Skills format was originally developed by Anthropic, released as an open standard, and is maintained at [github.com/agentskills/agentskills](https://github.com/agentskills/agentskills). It is adopted by a long list of agent products including Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, VS Code, OpenCode, OpenHands, Goose, Junie, Letta, and Microsoft Agent Framework ([client showcase](https://agentskills.io/clients), [Microsoft Learn](https://learn.microsoft.com/en-us/agent-framework/agents/skills)).

### Format ([specification](https://agentskills.io/specification))

- A skill is a directory containing at minimum `SKILL.md`; optional conventional subdirectories are `scripts/`, `references/`, and `assets/`.
- `SKILL.md` = YAML frontmatter + Markdown body. Frontmatter fields:

| Field | Required | Constraint |
| --- | --- | --- |
| `name` | yes | 1–64 chars, lowercase `a-z0-9` and single hyphens, no leading/trailing hyphen, must match parent directory name |
| `description` | yes | 1–1024 chars; what the skill does **and when to use it** (keywords drive activation) |
| `license` | no | License name or reference to bundled license file |
| `compatibility` | no | ≤500 chars; environment requirements (product, system packages, network) |
| `metadata` | no | Arbitrary string→string map for client-specific properties; keys should be namespaced to avoid collisions |
| `allowed-tools` | no | Space-separated pre-approved tool list; **experimental**, support varies |

- Unknown top-level fields are ignored for forward compatibility ([Microsoft Learn](https://learn.microsoft.com/en-us/agent-framework/agents/skills)).
- Progressive disclosure is the central design principle: tier 1 metadata (~100 tokens, all skills, at startup), tier 2 full body (<5000 tokens recommended, on activation), tier 3 bundled resources (on demand). Keep `SKILL.md` under 500 lines; move detail into `references/` one level deep.
- A reference validator exists: `skills-ref validate ./my-skill` ([skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)).

### Client implementation guidance ([adding skills support](https://agentskills.io/client-implementation/adding-skills-support))

- Discover skills by scanning directories for subdirectories containing exactly `SKILL.md`; skip `.git/`, `node_modules/`; bound depth (4–6) and directory count (~2000).
- Conventional scan locations: `<project>/.<client>/skills/`, `<project>/.agents/skills/`, `~/.<client>/skills/`, `~/.agents/skills/`. `.agents/skills/` is the cross-client interoperability convention. Some clients also scan `.claude/skills/` for compatibility.
- Name collisions: project-level overrides user-level; within a scope pick first-found or last-found consistently and log a warning.
- **Trust:** project-level skills come from possibly untrusted repositories; gate loading on the folder being trusted so a cloned repo cannot silently inject instructions.
- Store at least `name`, `description`, `location` (absolute path to `SKILL.md`) per skill; derive the skill base directory from `location` to resolve relative paths.
- Disclose the catalog either in the system prompt or in the description of a dedicated activation tool. Hide filtered (disabled/denied) skills entirely rather than blocking at activation. Omit the catalog and tool completely when no skills are available.
- Activation: file-read activation (model reads `SKILL.md` with its file tool) or dedicated tool (`activate_skill(name)` with `name` constrained to an enum of valid names). A dedicated tool allows stripping frontmatter, wrapping content in identifying tags, listing bundled resources without eagerly reading them, permission enforcement, and analytics.
- User-explicit activation via slash/mention syntax (`/skill-name`, `$skill-name`) should also exist.
- Allowlist skill directories in any permission system so bundled resources can be read without prompts.
- **Protect activated skill content from context compaction**; deduplicate re-activation; optionally run a skill in a dedicated subagent session and return only a summary.
- Lenient parsing: warn but load on cosmetic name issues; skip on missing description or unparseable YAML; consider a fallback for unquoted colons in descriptions.

### Authoring guidance ([best practices](https://agentskills.io/skill-creation/best-practices))

- Ground skills in real expertise (extract from completed tasks, runbooks, schemas, review comments, fix history) rather than generic LLM output; iterate with execution traces.
- Add only what the agent lacks; design coherent units (like a function); moderate detail; provide defaults not menus; favor procedures over declarations; include a "Gotchas" section; calibrate prescriptiveness to fragility; tell the agent *when* to read each reference file.

## skills.sh and the `skills` CLI (Vercel Labs)

- [skills.sh](https://skills.sh) is a public leaderboard/directory of Agent Skills ranked by anonymous install telemetry from the open-source `skills` CLI ([docs](https://skills.sh/docs), [github.com/vercel-labs/skills](https://github.com/vercel-labs/skills), MIT).
- Install: `npx skills add <owner/repo>`; sources include GitHub shorthand, full GitHub/GitLab/Azure Repos URLs, direct path to one skill within a repo, any Git URL, local paths, and direct `SKILL.md` or `.zip/.tar/.tgz` download URLs (download caps: 10 MiB download, 25 MiB extracted, 1000 files by default) ([README](https://github.com/vercel-labs/skills)).
- Private repositories reuse existing Git credential helper, GitHub CLI, or SSH auth; `GITHUB_TOKEN`/`GH_TOKEN` are optional.
- Scope: project (`./<agent>/skills/`) or global (`~/<agent>/skills/`). Method: **symlink to a canonical copy (recommended)** or copy per agent.
- Other commands: `skills use` (one-off prompt generation without install), `list`, `find [query]`, `remove`, `update`, `init [name]`.
- Discovery inside a repository: root `SKILL.md`, `skills/`, `skills/.curated|.experimental|.system/`, and every supported agent's project skills directory; container directories are walked up to three levels (`skills/<category>/<category>/<name>/SKILL.md`). `metadata.internal: true` hides a skill unless `INSTALL_INTERNAL_SKILLS=1`.
- The CLI knows roughly 80 agents' skill directories; **Devin for Terminal uses `.devin/skills/` (project) and `~/.config/devin/skills/` (global)**; many clients (Codex, Cursor, Copilot, Gemini CLI, OpenCode, Cline, Zed) use `.agents/skills/` at project level.
- **Packs** bundle public skills, private files, and GitHub-sourced skills into one unlisted install URL: `npx skills add https://skills.sh/p/<pack-id>`; packs are unlisted but not access-controlled ([packs](https://skills.sh/docs/packs)).
- **API** (`https://skills.sh/api/v1/…`): `/skills` (leaderboard, views `all-time|trending|hot`, paginated), `/skills/search`, `/skills/curated`, `/skills/{source}/{skill}`, `/skills/audit/{source}/{skill}` (security audit results). Authentication is by Vercel OIDC token only; 600 requests/minute per team/project ([API docs](https://skills.sh/docs/api)). A non-Vercel desktop app therefore cannot call this API directly without a proxy; unauthenticated leaderboard scraping is not documented.
- Security: routine audits exist, but skills.sh states it cannot guarantee the quality or security of every listed skill and encourages review before installing ([docs](https://skills.sh/docs)).
- "Publishing" is implicit: put skills in a Git repo; they appear on skills.sh via install telemetry ([Vercel KB](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context)).

## AGENTS.md (repository instructions for coding agents)

- A plain-Markdown "README for agents" at repository root, optionally nested per package (closest file wins; explicit chat prompts override). No required fields. Stewarded by the Agentic AI Foundation under the Linux Foundation; adopted by Codex, Jules, Devin, Cursor, Copilot coding agent, Gemini CLI, Zed, Warp, Aider, goose, opencode, Junie and others ([agents.md](https://agents.md/)).
- Typical sections: project overview, setup/build/test commands, code style, testing instructions, security considerations, PR/commit conventions.
- Relevance: (1) this repository should carry one; (2) each generated game Project folder should carry one so any external coding agent (and our own agents) find Project conventions and canon locations.

## Agent/subagent definition conventions (Claude Code as the most detailed public example)

Claude Code defines subagents as Markdown files with YAML frontmatter whose body becomes the system prompt; discovery locations `.claude/agents/` (project) and `~/.claude/agents/` (user), scanned recursively; identity comes from the `name` field, not the filename ([sub-agents docs](https://code.claude.com/docs/en/sub-agents)). Fields worth mirroring in our role-package schema:

| Field | Meaning |
| --- | --- |
| `name`, `description` | Required; description drives delegation decisions and must stay short (a 15,000-token total-description warning exists) |
| `tools` / `disallowedTools` | Allow/deny list; specifiers like `Bash(git push *)` |
| `model` | Alias, full ID, or `inherit` |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` — a subagent can only run in bypass if the parent does |
| `maxTurns` | Turn cap; partial output returned and resumable |
| `skills` | Skills preloaded in full at startup (others still discoverable) |
| `mcpServers` | Named or inline MCP servers for this agent |
| `hooks` | Lifecycle hooks scoped to the subagent |
| `memory` | `user`/`project`/`local` persistent memory directories |
| `isolation: worktree` | Run in a temporary Git worktree, cleaned up if unchanged |
| `effort`, `background`, `omitClaudeMd`, `initialPrompt`, `color` | Operational tuning |

- For security, plugin-supplied subagents cannot set `hooks`, `mcpServers`, or `permissionMode`; those are reserved for user/project-owned definitions. The same asymmetry is appropriate for marketplace agent roles in our plugin system.
- Built-in read-only "Explore"/"Plan" agents show the pattern of cheap research agents that keep exploration out of the main context.

## Theia AI (tool-builder framework inside Theia)

Source: [Theia AI documentation](https://theia-ide.org/docs/theia_ai/).

- An **Agent** is an injectable Theia service that builds prompts, calls a language model, and acts on the tool; a **Chat Agent** (`AbstractStreamParsingChatAgent`) plugs into the default chat UI and is addressable via `@Name`. Agents can delegate to other agents.
- **Prompt fragments** are registered by ID, editable by the user at runtime without rebuild, and support variable resolution and tool function references (`~{functionId}`).
- **Agent Capabilities**: `{{capability:fragment-id default on|off}}` inside a prompt template registers a user-toggleable chip; frontmatter (`name`, `description`) on the `.prompttemplate` file labels it. A capability fragment can carry instructions, tool references, or delegation instructions.
- **Variables** (global, agent-specific, chat-context) and **Tool Functions** (`ToolProvider` interface) are the extension points for context and actions; `@theia/ai-tool-sketchpad` allows prototyping tools without code.
- **LLM providers**: out-of-the-box OpenAI-compatible, Hugging Face, Ollama, Llamafile; custom providers implement `LanguageModel` and register with `LanguageModelRegistry`. Theia states there is **no fixed contribution point for language models yet** and the interfaces may still be consolidated.
- **AI Configuration view** categories (General, Providers & Models, Model Aliases, Agents, Prompts & Skills, Variables, Tools, Token Usage, MCP Servers) are contributed via `AiConfigurationCategory`; older per-tab widget registration was removed, and `@theia/ai-mcp` exists as an MCP integration package.
- **Workspace trust** governs whether AI preferences from a workspace are honored (`AiConfigurationService`).
- `@theia/ai-copilot` ships a GitHub Copilot integration whose default OAuth app is for Theia IDE only; downstream products must register their own OAuth app.
- Implication: Theia AI is a good fit for in-editor chat, inline agents, prompt editing, and configuration UI, but its LLM provider layer is explicitly unstable, and it runs inside the Theia frontend/backend rather than our durable platform service. That matches the existing decision that the platform service owns the persistent swarm, router, and access enforcement ([technical architecture](../TECHNICAL_ARCHITECTURE.md#recommended-core-stack)).

## Model Context Protocol (MCP) — current state

- The current specification revision is **2026-07-28**; prior revisions include 2025-11-25, 2025-06-18, 2025-03-26 ([latest changelog](https://modelcontextprotocol.io/specification/latest/changelog)).
- 2026-07-28 major changes: **protocol-level sessions removed** (no `Mcp-Session-Id`); **stateless** design with no `initialize` handshake — every request carries protocol version and client capabilities in `_meta`; new mandatory `server/discover` RPC; `subscriptions/listen` long-lived stream replaces GET endpoint and resource subscriptions; `ping`, `logging/setLevel`, roots-changed notifications removed; **tasks** moved to an official extension (`io.modelcontextprotocol/tasks`, poll via `tasks/get`); **Multi Round-Trip Requests (MRTR)** replace server-initiated `sampling`, `elicitation`, `roots/list` — servers return `resultType: "input_required"` and clients retry with `inputResponses`; all results carry `resultType`; SSE resumability removed.
- 2026-07-28 deprecations: **Roots, Sampling, Logging features**; HTTP+SSE transport (already deprecated since 2025-03-26); `includeContext` values `thisServer`/`allServers`.
- Earlier (2025-06-18) additions still in force: structured tool output, resource links in tool results, elicitation (now via MRTR), OAuth resource-server classification with RFC 8707 resource indicators, `MCP-Protocol-Version` header on HTTP, `title` fields, `_meta` conventions ([2025-06-18 changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)).
- Minor 2026-07-28 items relevant to a client: `extensions` capability field; OpenTelemetry trace context in `_meta`; deterministic `tools/list` ordering for prompt caching; `ttlMs`/`cacheScope` on list results; JSON Schema 2020-12 for tool schemas; error-code partitioning (`-32020`…`-32099` reserved for MCP).
- The TypeScript SDK ([ts.sdk.modelcontextprotocol.io](https://ts.sdk.modelcontextprotocol.io/)) implements stdio and Streamable HTTP transports.
- Implication: many community engine/DCC MCP servers (see [engine-connectors.md](engine-connectors.md), [dcc-and-asset-tools.md](dcc-and-asset-tools.md)) were written against 2025-era revisions with the `initialize` handshake and sessions. The platform's MCP connection manager must negotiate across at least 2025-03-26, 2025-06-18, 2025-11-25, and 2026-07-28, use `server/discover` as a probe with fallback to legacy `initialize`, and not depend on the deprecated Sampling/Roots/Logging features for anything essential.

## Sources

- [Agent Skills specification](https://agentskills.io/specification)
- [Agent Skills: adding skills support to an agent](https://agentskills.io/client-implementation/adding-skills-support)
- [Agent Skills: best practices for skill creators](https://agentskills.io/skill-creation/best-practices)
- [Agent Skills client showcase](https://agentskills.io/clients)
- [agentskills/agentskills repository](https://github.com/agentskills/agentskills)
- [Microsoft Agent Framework: Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
- [skills.sh documentation](https://skills.sh/docs), [packs](https://skills.sh/docs/packs), [API](https://skills.sh/docs/api)
- [vercel-labs/skills README](https://github.com/vercel-labs/skills)
- [Vercel KB: Agent Skills guide](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context)
- [AGENTS.md](https://agents.md/)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
- [Theia AI documentation](https://theia-ide.org/docs/theia_ai/)
- [MCP latest changelog (2026-07-28)](https://modelcontextprotocol.io/specification/latest/changelog)
- [MCP 2025-06-18 changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)
- [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/)
