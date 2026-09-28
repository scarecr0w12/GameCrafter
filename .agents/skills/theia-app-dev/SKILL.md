---
name: theia-app-dev
description: Scaffold, extend, and run the Eclipse Theia desktop application and Theia extensions for the Game Development Control Room (TypeScript, InversifyJS DI, contribution points, Electron target, Theia AI agents and tool providers). Use when creating the Theia monorepo, adding a Theia extension, wiring a widget/command/menu/preference, or integrating a Theia AI agent.
license: MIT
compatibility: Requires Node.js >=18, yarn 1.x (Theia default), and native build tools for Electron rebuilds. Desktop target is Electron on Windows/Linux only.
metadata:
  author: gamedev-platform
  version: "1.0"
---

# Theia application and extension development

Project rule: the Theia app is a **client** of the local platform service. Do not put durable state (tasks, board, router learning, Project records) in Theia frontend/backend code; call the service over its RPC API. See `docs/TECHNICAL_ARCHITECTURE.md`.

## Scaffold (first time)

```bash
npm install -g yo generator-theia-extension
mkdir <app> && cd <app>
yo theia-extension   # pick "Hello World" (or "Empty") and answer prompts
yarn                 # installs workspaces
yarn build:electron && yarn start:electron
```

The generator creates a yarn/lerna monorepo with `browser-app/`, `electron-app/`, and one extension package. Keep `browser-app` only as a dev convenience; the product is desktop-only (`"theia": { "target": "electron" }`). Source: [Build your own IDE/Tool](https://theia-ide.org/docs/composing_applications/).

## Anatomy of an extension package

- `package.json` must contain `"keywords": ["theia-extension"]` and a `theiaExtensions` array listing DI module entry points: `{ "frontend": "lib/browser/<x>-frontend-module" }`, `{ "backend": "lib/node/<x>-backend-module" }`, or Electron-specific keys.
- Each module file default-exports an InversifyJS `ContainerModule`: `export default new ContainerModule(bind => { bind(CommandContribution).to(MyCommands); bind(MenuContribution).to(MyMenus); });`
- Behaviour is added by implementing `*Contribution` interfaces (`CommandContribution`, `MenuContribution`, `KeybindingContribution`, `FrontendApplicationContribution`, `BackendApplicationContribution`, `PreferenceContribution`, `WidgetFactory`, …) and binding them; the runtime multi-injects all contributions of a kind.
- Use `@injectable()` classes and `@inject(Service)` constructor params; never `new` a Theia service.
- Add the extension to the app's `dependencies` in `electron-app/package.json`; the app scripts run `theia rebuild:electron` then `theia build`.
Source: [Authoring Theia Extensions](https://theia-ide.org/docs/authoring_extensions/).

## Frontend/backend split

Frontend (browser/Electron renderer) and backend (Node) each have their own DI container. Cross-process calls use Theia's JSON-RPC (`ConnectionHandler` / `RpcConnectionHandler` in the backend, proxied service in the frontend). Anything touching the filesystem, child processes, or the platform service belongs in the backend module. Source: [Architecture overview](https://theia-ide.org/docs/architecture/), [JSON-RPC](https://theia-ide.org/docs/json_rpc/).

## Custom views

Implement a `ReactWidget` (or `BaseWidget`) and register a `WidgetFactory` plus an `AbstractViewContribution` to give it a command, menu entry, and default dock area. Follow the Control Room surface list in `docs/PLATFORM_DESIGN.md` (Project home, canon, task graph, board, assets, connections, validation, settings). Source: [Widgets](https://theia-ide.org/docs/widgets/).

## Settings

Expose every configurable behaviour through Theia preferences (`PreferenceContribution` with a JSON schema) **and** the platform settings system; the UI must show effective value and scope (platform/Project/session). Do not create one long settings page. Source: [Preferences](https://theia-ide.org/docs/preferences/).

## Theia AI integration boundary

- Use `@theia/ai-core` / `@theia/ai-chat` for in-editor chat agents: extend `AbstractStreamParsingChatAgent`, register a prompt fragment (`BasePromptFragment` with `id` + `template`), set `languageModelRequirements`, bind the agent via DI.
- Expose actions to models with `ToolProvider` implementations (`bind(ToolProvider).to(MyTool)`); reference them in prompt fragments as `~{toolId}`.
- Declare user-toggleable behaviour with `{{capability:fragment-id default on|off}}` and label it with frontmatter (`name`, `description`) on the `.prompttemplate`.
- Contribute settings pages to the AI Configuration view with `AiConfigurationCategory` (the old `WidgetFactory` tab approach was removed).
- **Do not** implement the platform's model router as a Theia `LanguageModel`; Theia documents that its LLM-provider interfaces have no fixed contribution point yet. Bridge Theia AI to the platform service's router through one adapter `LanguageModel` that forwards requests, so eligibility and routing rules stay in the service.
Source: [Theia AI](https://theia-ide.org/docs/theia_ai/).

## Unified Plugins catalog

Theia distinguishes compiled **Theia extensions** from runtime **plugins** (VS Code-compatible, installable via Open VSX). Our game-platform plugins are a third kind with their own manifest and runtime (see `docs/SKILLS_AGENTS_AND_TOOLS.md`). Show the type and privilege boundary in the catalog UI. Source: [Extensions and Plugins](https://theia-ide.org/docs/extensions/).

## Gotchas

- Generated `package.json` snippets in Theia docs pin `"@theia/core": "latest"`; pin an exact Theia version across all packages and run `theia check:theia-version` (postinstall in the generated root).
- Electron native modules must be rebuilt (`theia rebuild:electron`) after dependency changes; failures usually mean missing build tools, not code errors.
- Theia uses yarn 1.x workspaces + lerna by default; do not mix with pnpm/npm in the same tree.
- Keep Theia-facing TypeScript strict; Theia's own tsconfig uses `strict: true` and decorators (`experimentalDecorators`, `emitDecoratorMetadata`) which InversifyJS requires.
- Never let plugin or agent code depend on Theia internals; keep Project/task records in the service's contracts package.
