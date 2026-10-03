# Documentation standards and native workflow verification

**Last researched:** 2026-10-02

## Purpose

Support the contributor examples and capability distinctions in [skills, agents and tools](../SKILLS_AGENTS_AND_TOOLS.md) and [technical architecture](../TECHNICAL_ARCHITECTURE.md). This is a targeted refresh; it does not replace the older topic notes or declare protocol/provider acceptance. Repository findings use local implementation links. External findings use the official pages opened in this pass.

## MCP

- Edition checked: **2026-07-28**. The overview describes JSON-RPC 2.0, stateless self-contained requests and per-request capability negotiation. It lists server resources, prompts and tools; elicitation; progress/cancellation/error reporting; and optional extensions. [Specification](https://modelcontextprotocol.io/specification/2026-07-28).
- Extensions listed include Tasks, Skills over MCP and MCP Apps. The same overview mentions initialization for extension negotiation while describing stateless core requests. This pass does not infer a universal handshake from that overview; implementers must inspect the component/revision requirements. [Specification](https://modelcontextprotocol.io/specification/2026-07-28).
- The overview treats tool annotations as untrusted unless supplied by a trusted server, and calls for consent/access controls around data and tool invocation. Protocol support alone does not enforce those protections. [Specification](https://modelcontextprotocol.io/specification/2026-07-28).

Repository comparison:

- The contract advertises 2026-07-28 and three 2025 revisions. This is a local implementation finding, not external server acceptance. [MCP contracts](../../packages/contracts/src/mcp/schema.ts).
- Session/transport adapters implement revision-specific behavior. Tests exercise fixtures; connecting a real engine needs a separate native identity probe and accepted operation. [Session implementation](../../packages/platform-service/src/mcp/session.ts), [connection manager](../../packages/platform-service/src/mcp/connection-manager.ts).
- No new revision selection, public schema or protocol compatibility decision is introduced by this note.

## Agent Skills

- The specification requires a skill directory containing `SKILL.md`; optional scripts, references and assets may accompany it. `SKILL.md` contains YAML frontmatter and Markdown instructions. [Specification](https://agentskills.io/specification).
- Required fields are `name` and `description`; name constraints include lowercase letters/numbers/hyphens and a maximum of 64 characters. Metadata is a string key/value map; `allowed-tools` is experimental. [Specification](https://agentskills.io/specification).

Repository comparison:

- Project metadata keeps the `gamecrafter-` prefix. Loader/registry validation and enablement are platform behavior; a skill's instructions do not grant broker access. [Skill loader](../../packages/platform-service/src/skills/skill-loader.ts), [registry](../../packages/platform-service/src/skills/skill-registry.ts).
- `ROLE.md` is the existing platform role contract, separate from the external skill format. [Role schema](../../packages/contracts/src/skills/schema.ts).
- License, current repository activity dates and product adoption lists were not refreshed here; do not promote the older ecosystem note's lists as newly verified facts.

## Theia extension authoring

- The official authoring page describes dedicated extension packages, frontend/backend dependency injection modules, `theiaExtensions` registration and application dependency wiring. Its sample command/menu implementation uses contribution interfaces and services. [Authoring extensions](https://theia-ide.org/docs/authoring_extensions/).
- The page itself warns that package listings may be outdated and directs readers to generated examples. Its last-updated label is February 20, 2025; this pass does not adopt its sample dependency versions or package commands. [Authoring extensions](https://theia-ide.org/docs/authoring_extensions/).

Repository comparison:

- The Control Room extension is compiled into desktop/browser targets. The repository uses npm and exact shared Theia pins, independently of upstream sample commands. [Extension package](../../packages/theia-control-room/package.json), [desktop package](../../apps/control-room/package.json).
- Platform plugins use a service-managed manifest and worker SDK; they are distinct from Theia application extensions and engine-side editor addons. [Plugin contracts](../../packages/contracts/src/plugins/schema.ts), [SDK](../../packages/plugin-sdk/src/).
- No dependency change is required by this documentation refresh.

## Godot command-line workflow

- Official stable documentation describes `--path` for selecting a Project, `--headless` for headless display/dummy audio, editor mode and script execution. CLI scripts must inherit `SceneTree` or `MainLoop`. [Command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html).
- Release export requires a configured preset and installed/custom export templates; a parse/gameplay script does not establish a packaged release. [Command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html).

Repository comparison:

- Current local engine observed by `--version`: **4.7.2.stable.official.ed1daf0bf**, installed in WSL on a Windows host. The portable tutorial source carries its own declared feature version; this check does not rewrite that declaration to match the test host. [Native verifier](../../scripts/verify-documentation-native.cjs).
- Import and scripted gameplay checks run only against a disposable copy. Assertions cover collection count, repeat collection, reset, movement and bounds. No graphical rendering/export/live-editor claim is made. [Acceptance script](../examples/lantern-workshop/game/acceptance.gd).
- The first harness ran before viewport readiness and failed collection/movement assertions. Explicit viewport initialization and input flushing fixed the harness; native source import already passed. Original failures remain in ignored local logs. This was a harness defect, not evidence of a broken collection mechanic.

## Unity and Unreal operational context

- Unity **6000.0** documentation describes editor command-line options including batch operation, Project selection and execution/logging controls. The checked page is version-specific; it does not establish that every installed Unity version has identical switches. [Unity Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html).
- Epic's Unreal **5.8** Automation Tool overview describes a C# host for automation scripts with tasks such as building, cooking and packaging. Automation Tool operation is distinct from a live editor bridge. [Automation Tool overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-automation-tool-overview-for-unreal-engine).

Repository comparison:

- Existing Unity/Unreal acceptance notes identify disposable fixtures and host/version results. They remain historical until rerun in this pass. [Live acceptance](../LIVE_ENGINE_ACCEPTANCE.md), [extended acceptance](../EXTENDED_ENGINE_ACCEPTANCE.md).
- Installed tooling and an executable returning zero are not sufficient evidence of a passing engine test report. Retain parsed failures and run artifacts. [Engine implementation](../../packages/platform-service/src/engines/).

## Provider and Blender refresh limits

- OpenAI's official Chat API reference was accessible at the redirected developer reference. This note only uses it to identify the documented API family; it does not claim that a PlayWeld provider adapter or a live model completed a request. [Chat API reference](https://developers.openai.com/api/reference/resources/chat).
- Anthropic Messages documentation could not be read through the research tool: one URL failed and the current platform page exceeded the content limit. Authentication, request fields, current model support and billing for that page remain **unverified** in this pass. [Messages documentation](https://platform.claude.com/docs/en/api/messages).
- Blender latest and 4.5 command-line manual URLs could not be fetched; the 4.5 request returned a 402 fetch error. This does not establish a paywall in the product or a changed CLI. Manual claims remain **unverified** here. [Blender 4.5 command-line arguments](https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html).
- Fixture providers in the screenshot runner are synthetic. Their outputs support UI/runtime boundaries, not paid-provider reasoning, quality, rate limits or spend. [Capture runner](../../scripts/capture-documentation.cjs).

## Implications and outstanding verification

- Keep protocol revision, transport, editor identity and operation acceptance as separate evidence fields.
- Preserve established npm pins/contracts; external documentation samples do not override repository conventions.
- Keep missing engine/export/isolation/provider prerequisites visible in examples.
- Recheck inaccessible provider/Blender pages before adopting specific current API or CLI facts into design requirements.
- No register item is resolved, and no work-package status is advanced by this targeted research pass.

## Sources

- [MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28).
- [Agent Skills specification](https://agentskills.io/specification).
- [Theia authoring extensions](https://theia-ide.org/docs/authoring_extensions/).
- [Godot command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html).
- [Unity 6000.0 editor arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html).
- [Unreal Automation Tool](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-automation-tool-overview-for-unreal-engine).
- [OpenAI Chat reference](https://developers.openai.com/api/reference/resources/chat).
- [Anthropic Messages, unverified](https://platform.claude.com/docs/en/api/messages).
- [Blender 4.5 arguments, unverified](https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html).
