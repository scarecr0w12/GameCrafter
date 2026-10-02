# Extended engine acceptance

**Last updated:** 2026-10-01

This extends [Windows headless and packaged acceptance](LIVE_ENGINE_ACCEPTANCE.md) with live editor connections, rendering, audio, browser input, and additional installed targets. All work uses disposable fixtures under `.turbo/live-engine-acceptance/projects`. No existing production game was selected or certified.

## Executed matrix

| Engine and target                             | Executed checks                                                                                                                                              | Evidence boundary                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unity 6000.6.0f1 / Windows Development player | Direct3D 12 rendering on Radeon RX 7900 XTX; imported WAV playback; pause silence; resumed samples; rendered PNG                                             | Built player on this Windows host; engine DSP output, not a human listening test                                                                                                          |
| Unity 6000.6.0f1 / Linux Development player   | Linux export; OpenGL rendering; imported WAV playback and pause/resume; rendered PNG                                                                         | Executed through WSL using llvmpipe software rendering; not native Linux GPU acceptance                                                                                                   |
| Unity 6000.6.0f1 / WebGL                      | Export; Chromium 152.0.7977.82 startup; rendered pixels; browser Space input reaching Unity; Web Audio playback, pause silence, and resumed output           | Headless Chromium with SwiftShader; no claim about all browsers or physical Windows keyboard input                                                                                        |
| Unity 6000.6.0f1 / live Editor                | Official CLI MCP handshake; 160 discovered tools; read-only editor identity; screenshot through GameCrafter's broker with retained PNG artifact              | Real Unity Pipeline 0.8.0-exp.1 and CLI 1.0.0; metadata classification explicitly configured for the fixture                                                                              |
| Unreal 5.8.3 / live Windows Editor            | CodeFizz health identity, MCP handshake and discovery of 61 editor tools; creation and save of a separate Basic-template map; viewport PNG after compilation | CodeFizz CLI 2.23.1 / plugin 1.17.0; External editor calls plus brokered identity and viewport screenshots through a two-tool acceptance adapter; not a bundled general-purpose connector |
| Unreal 5.8.3 / Windows game mode              | C++ compilation; separate audio map; recorded master-output WAVs for playing, paused, and resumed states                                                     | Editor executable in `-game -nullrhi` mode; actual WASAPI mixer; not a packaged audio test                                                                                                |
| Unreal 5.8.1 / Linux                          | Real Linux editor Python commandlet startup and engine-version assertion                                                                                     | Engine/API startup only; no C++ game build, Linux package, graphics, or input acceptance                                                                                                  |

Windows audio devices were exercised through the engine's output path. Captured samples establish engine output, not speaker audibility, subjective mix quality, latency, or hardware loopback coverage.

## Assertions and repairs

The Unity player renders an unlit neon-green cube against a dark violet background. Its 256 × 256 render capture must contain more than 1,000 green pixels and use an active renderer. Each accepted target produced 4,096 matching pixels. This is a controlled rendering assertion, not a visual review of production content.

Windows and Linux Unity audio assertions require playing and resumed peaks above 0.01 and a paused peak below 0.001. DSP startup waits for real samples within a bounded window. The fixture now imports a generated PCM WAV rather than depending on procedural sample APIs across every target.

The WebGL harness measures Unity's Web Audio output with browser analysers. It requires nonzero playing/resumed samples, at least two silent paused observations, a Space event recorded inside Unity, and no JavaScript page errors. Native Unity DSP measurements are explicitly marked as requiring an external browser analyser on this target; the browser report is the authoritative combined result.

Unreal records three master-output WAV files. The runner validates RIFF chunk bounds, PCM format, sample count, and playing/paused/resumed peaks. Unfocused audio is enabled in this fixture's `DefaultEngine.ini`; shared engine configuration and other game Projects are not changed.

Live bridge testing reproduced and fixed these platform defects:

- Editor identity returned the native `game` directory, while the platform compared only the enclosing Project workspace. Exact native-folder matches now work, with case-insensitive comparison on Windows. A nested or unrelated Project still fails identity proof.
- Unity screenshots return a local PNG path rather than inline MCP image bytes. The platform now collects PNG files only from within the current Project, resolves symlinks, checks file bounds and signature, and retains the copy as a run artifact.
- A screenshot operation without a collectable image previously reported success. It now fails; missing files and paths outside the Project have regression coverage.

The installed MCP SDK also exposed a schema compatibility defect: its explicit draft-07 tool schemas were sent to a 2020-12-only validator. External MCP/plugin schemas now use their explicitly declared draft-07 dialect, otherwise 2020-12. Both dialects use isolated validators and reject unresolved external references. Legacy tuple semantics, duplicate schema IDs, and unknown dialects have regression coverage.

The [CodeFizz acceptance adapter](../scripts/codefizz-acceptance-mcp.cjs) exposes only `project_identity` and `screenshot`. It reads the current bridge port, checks the live CLI health response against the exact selected `.uproject`, and returns bounded viewport PNG bytes. It never substitutes file inspection for a live identity reply. A deliberately mismatched Project was rejected for both identity and capture without creating a capture directory. Restricted mode denied capture writes through the platform broker.

## Repeatable commands

The baseline fixture must exist and native packages must be built before using the extended runner. The runner accepts `GC_ACCEPTANCE_UNITY`, `GC_ACCEPTANCE_UNITY_CLI`, `GC_ACCEPTANCE_UNREAL`, and `GC_ACCEPTANCE_UNREAL_LINUX` path overrides. These locate executables; they do not prove support for another version.

From native Windows Node:

```text
node scripts/extended-engine-acceptance.cjs build-windows
node scripts/extended-engine-acceptance.cjs player-windows
node scripts/extended-engine-acceptance.cjs build-linux
node scripts/extended-engine-acceptance.cjs build-web
node scripts/extended-engine-acceptance.cjs unreal-audio
```

From Linux/WSL after export:

```bash
node scripts/extended-engine-acceptance.cjs player-linux
node scripts/extended-engine-acceptance.cjs unreal-linux
```

The Linux Unreal commandlet must run as a non-root user. When invoked as root, the fixture runner uses `runuser` and defaults to this host's `ubuntu` account; `GC_ACCEPTANCE_LINUX_USER` overrides that account. The engine process has a bounded timeout. Its temporary Project is writable by that account.

For Unity MCP acceptance, install the pinned Pipeline package into the disposable Unity fixture and open that fixture in the Editor. Run these stages while it is open:

```text
node scripts/extended-engine-acceptance.cjs unity-mcp
node scripts/extended-engine-acceptance.cjs unity-platform
```

For Unreal, enable the installed CodeFizz plugin in the disposable fixture, open that fixture in the Editor, and run `node scripts/extended-engine-acceptance.cjs unreal-platform`. The adapter is acceptance tooling in this checkout; it is not automatically installed into the released desktop app.

The platform stage starts an isolated acceptance service, explicitly classifies the identity probe as read-only, binds the connection, verifies identity, captures a screenshot, and disconnects. It does not change the normal user profile.

For WebGL, run this from the built `ExtendedBuild/WebGL` directory, substituting absolute repository paths:

```bash
python3 /path/to/repo/.agents/skills/webapp-testing/scripts/with_server.py \
  --server 'exec python3 -m http.server 3187 --bind 127.0.0.1' --port 3187 -- \
  python3 /path/to/repo/scripts/engine-web-acceptance.py \
  --output /path/to/repo/.turbo/extended-engine-acceptance
```

The `exec` prefix lets the helper terminate the actual HTTP server. Python Playwright and `/usr/bin/google-chrome` are required on this tested host.

## Artifacts and verification

Reports, compiler/runtime logs, screenshots, and recorded WAVs are under `.turbo/extended-engine-acceptance`. Source fixtures are in [scripts/fixtures/engine-acceptance](../scripts/fixtures/engine-acceptance); the reusable runners are [extended-engine-acceptance.cjs](../scripts/extended-engine-acceptance.cjs) and [engine-web-acceptance.py](../scripts/engine-web-acceptance.py).

Full repository build/typecheck/lint/test completed successfully on Windows and Linux: 33/33 Turborepo tasks on each. Linux passed 426 tests; Windows passed 414, with 12 explicit platform/capability skips. Generated engine fixtures are tested separately from those repository checks.

Reported frame averages and managed-memory values are fixture observations. The Windows player was capped at 60 frames per second; these measurements do not establish production frame budgets, total engine memory, or an optimization gain.

## Remaining acceptance gaps

- **Physical desktop input and navigation:** the installed Computer Use helper rejects this WSL session's workspace URI before connecting, including after a reset. Web browser input passed separately. A working Windows helper/session is needed for mouse, keyboard, controller, desktop navigation, and focus acceptance.
- **Broader bridge operations and distribution:** Unity identity and screenshots passed against the official MCP server. Unreal identity and screenshots passed through the acceptance adapter; direct CodeFizz MCP still lacks the required identity tool. General scene/console routing, automatic adapter distribution, and Godot live editor binding remain outside this accepted matrix.
- **Third-party bridge defects:** CodeFizz automatic editor discovery failed on this host despite a responsive bridge; calls succeeded using the observed port after verifying its Project identity. Unity Pipeline's `quit` command failed in EditMode with a `DontDestroyOnLoad` error. These external-tool failures are retained; they are not described as fixed in GameCrafter.
- **Production acceptance and performance:** an existing game Project, its supported targets, representative scenes, and acceptance criteria must be selected. Fixture success does not certify gameplay, asset quality, accessibility, multiplayer, saves, performance, or release readiness for that game.
- **Additional targets:** other installed SDK/engine combinations, Unreal Linux C++/packaging, packaged Unreal audio, controllers, hardware audio loopback, and GPU/browser/device combinations remain outside the accepted matrix. C04 remains Verify.

Unity's documented Pipeline setup and Web audio constraints informed the harness; the executed results above come from local artifacts. See [official CLI setup](https://docs.unity.com/en-us/unity-cli/use-unity-cli) and [Unity 6000.6 Web audio](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/audio).
