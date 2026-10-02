# Game systems workflows for the first-party skill library

**Last researched:** 2026-10-01

## Purpose

This note informs executable game-production guidance under [Skills, agents, and tools](../SKILLS_AGENTS_AND_TOOLS.md), especially skills authoring and progressive disclosure. It separates public documentation findings from the original workflow recommendations embodied in the skill library. It does not establish that an engine, game, platform integration, or authored skill has been exercised live.

## Game design, levels, and narrative

- Unity’s Creative Core prototyping course covers selecting an appropriate prototype approach, identifying critical features, creating a playable prototype, refining an environment, and testing the experience. [Unity Creative Core: Prototyping](https://learn.unity.com/course/creative-core-prototyping).
- Ink supports branching dialogue and story flow through choices, named content sections, and diverts; its writing manual describes branching and recombining flow. [Writing with Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).
- Ink’s manual describes conditional content and explicit ending markers; it also illustrates a loop that is syntactically legal but undesirable. [Writing with Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).

Recommended approach:

- Make design reviews produce a player-experience contract, a concrete uncertainty, and a small prototype question.
- Make level workflows produce an editable route graph, measured player metrics, a blockout, and traversal evidence.
- Treat readability, camera, collision, encounter decisions, and checkpoint recovery as parts of spatial design.
- Make narrative work separate world facts, player knowledge, and character beliefs before writing conditions.
- Use the project’s selected narrative format; Ink is a documented example, not a required runtime.
- Include interruption, revisit, branch exit, and reward-duplication checks in narrative verification.
- Human enjoyment, pacing, and emotional effect remain judgments requiring appropriate playtest feedback.

## Gameplay architecture and testing

- Godot recommends self-contained scenes and, where external dependencies are required, parent/context-mediated dependency injection and loose coupling. [Godot scene organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html).
- Godot documents configuration warnings as an editor-visible way to expose unmet scene dependencies. [Godot scene organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html).
- Unity’s Test Framework distinguishes Edit Mode tests from Play Mode tests and supports Player test execution; the opened reference targets package version 2.0 rather than an unspecified installed version. [Unity test environments](https://docs.unity3d.com/Packages/com.unity.test-framework@2.0/manual/edit-mode-vs-play-mode-tests.html).
- Epic’s Automation Test Framework documents unit, feature, content-stress, and screenshot comparison uses, while noting that engine-dependent automation is not ideal for pure unit tests. [Epic Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine).
- Epic advises automation tests not to assume editor/game state and to clean up generated files. [Epic Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine).

Recommended approach:

- Specify state ownership, lifecycle, input contracts, and failure behavior before selecting a game-system architecture.
- Test independent rules separately from engine lifecycle and packaged game behavior.
- Use gameplay captures or interaction assertions for behavior that a screenshot alone cannot prove.
- Make reproducible inputs, initial state, runtime version, and evidence location part of each handoff.
- In-game NPC controller selection, action contracts, perception boundaries, recovery states, and tuning guidance in `game-ai` are original recommendations in this pass.
- No behavior-tree, utility-AI, or pathfinding implementation claims were externally verified or run for this library.

## Multiplayer and security

- Epic recommends considering multiplayer architecture early when a project may require networked gameplay. [Epic networking overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine).
- Godot’s high-level multiplayer manual advises server authority for gameplay-critical decisions in competitive or persistent games, validation of RPC arguments, and limits on frequent actions. [Godot high-level multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html).
- Godot explicitly warns that its multiplayer lobby examples need modification for dedicated-server use because the server is assumed to participate as a player. [Godot high-level multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html).
- OWASP’s WebSocket guidance covers transport encryption, browser origin checks, authentication, action-level authorization, message bounds, rate limits, session expiry, and security testing. [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).
- OWASP advises avoiding sensitive message contents, tokens, and session identifiers in WebSocket logs. [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).

Recommended approach:

- Make a multiplayer skill establish topology, authority, bounded messages, and join/leave behavior before adding more mechanics.
- Exercise one gameplay transaction between separate processes and record server/client outcomes.
- Test simultaneous actions, late joining, interruption, replay/retry, and adverse network conditions.
- Treat session authentication, transport protection, per-action authorization, and game-state validation as distinct concerns.
- Apply browser origin and cookie guidance to browser WebSockets; do not transplant it into native UDP or Unix-socket authentication.
- Validate security findings against existing controls and an authorized local reproduction before claiming a vulnerability.
- Label hardening proposals separately from demonstrated security failures.

## Accessibility and localization

- Xbox Accessibility Guidelines include feature-oriented goals, scoping questions, implementation guidance, and player-impact information. Microsoft states the guidelines are not a checklist for legal compliance. [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines).
- XAG 107 addresses input-related barriers and implementation guidance for supported interaction methods. [XAG 107: Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107).
- Godot documents locale selection/fallback, translated resources, flexible UI sizing, font fallback, and bidirectional text concerns. [Godot internationalizing games](https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html).
- Godot describes pseudolocalization for finding untranslated text and expansion/layout problems, while warning it is inadequate for testing CJK font support or right-to-left languages. [Godot internationalizing games](https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html), [Godot pseudolocalization](https://docs.godotengine.org/en/stable/tutorials/i18n/pseudolocalization.html).

Recommended approach:

- Scope accessibility around actual required player actions and information barriers.
- Produce scenario-level before/after evidence and explicit affected-player feedback gaps.
- Verify that settings are discoverable, persisted, and effective in gameplay rather than only present in a menu.
- Keep translation context, placeholders, speaker information, fonts, and asset remaps with the content handoff.
- Run pseudolocalization and actual selected-script/direction tests as separate checks.
- Distinguish internationalization engineering validation from fluent human review of meaning and voice.

## Profiling and release production

- Unity documents profiling a built application on a target device using a development build and optional profiler connection/instrumentation settings. [Unity target-device profiling](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html).
- Unreal Insights documents timing, memory, networking, Slate/UI, cooking, and audio analysis facilities; available workflows vary with engine build and operating system. [Epic Unreal Insights](https://dev.epicgames.com/documentation/unreal-engine/unreal-insights-in-unreal-engine?lang=en-US).
- Steam builds represent depot content at a point in time, and manifests describe files with metadata; Steam supports beta branches for testing updates. [Steamworks Builds](https://partner.steamgames.com/doc/store/application/builds?l=english).
- Steam warns that changing the default live build of a released game distributes the update to owners. [Steamworks Builds](https://partner.steamgames.com/doc/store/application/builds?l=english).
- Steam separates store-page and game-build readiness/review from the explicit release action. [Steamworks Release Process](https://partner.steamgames.com/doc/store/releasing?l=english).

Recommended approach:

- Require comparable before/after workload captures for measured performance improvements.
- Record hardware, revision, graphics settings, instrumentation, warmup, and capture duration.
- Inspect frame-time spikes and sustained resource behavior when those are the reported failure.
- Produce a versioned packaged build, manifest, installation evidence, and update/save compatibility results.
- Keep test upload, review approval, default-branch update, and publication as separate reported states.
- Restricted console certification manuals and actual store account permissions were not verified in this pass.

## Verification and freshness limits

- The opened Epic pages resolved to current UE 5.8 documentation; use documentation matching the actual installed version before executing engine-specific instructions. [Epic networking overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine).
- Godot `stable` links and Ink’s default-branch manual can change; preserve observed runtime/version context in execution evidence. [Godot scene organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html), [Writing with Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).
- This pass opened public documentation and authored original workflows; engine execution, multiplayer deployment, participant playtests, translations, benchmarks, and store publication were not performed.
- Discussion-board maintenance is a repository-specific recommendation. The library does not claim an available board RPC method or successful board mutation.
- A later live implementation should refresh relevant version-specific sources and record commands/results rather than inheriting this note’s research date as execution evidence.

## Sources

- [Unity Creative Core: Prototyping](https://learn.unity.com/course/creative-core-prototyping)
- [Writing with Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md)
- [Godot scene organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html)
- [Unity test environments](https://docs.unity3d.com/Packages/com.unity.test-framework@2.0/manual/edit-mode-vs-play-mode-tests.html)
- [Epic Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine)
- [Godot high-level multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html)
- [Epic networking overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine)
- [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines)
- [XAG 107: Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107)
- [Godot internationalizing games](https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html)
- [Godot pseudolocalization](https://docs.godotengine.org/en/stable/tutorials/i18n/pseudolocalization.html)
- [Unity target-device profiling](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html)
- [Epic Unreal Insights](https://dev.epicgames.com/documentation/unreal-engine/unreal-insights-in-unreal-engine?lang=en-US)
- [Steamworks Builds](https://partner.steamgames.com/doc/store/application/builds?l=english)
- [Steamworks Release Process](https://partner.steamgames.com/doc/store/releasing?l=english)
