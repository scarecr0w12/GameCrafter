# Unity and Unreal live acceptance

**Last updated:** 2026-10-01

This record covers isolated fixture projects on this Windows 11 x64 host. It does not certify an existing game, every engine version, graphics quality, performance, or an MCP editor bridge. The fixture source and repeatable runner live in [scripts/live-engine-acceptance.cjs](../scripts/live-engine-acceptance.cjs) and [scripts/fixtures/engine-acceptance](../scripts/fixtures/engine-acceptance).

Additional editor, graphics, audio, browser-input and Linux target checks are recorded separately in [extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md). The matrix below preserves the scope of the original headless run.

## Installed software and evidence boundary

| Component            | Actual installation/version                                                              | Scope exercised                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Unity Editor         | `D:\Unity\Editor\6000.6.0f1\Editor\Unity.exe`, 6000.6.0f1                                | Batch import/compilation, EditMode, PlayMode, Windows Development build, built player           |
| Unity Test Framework | Installed built-in package 1.8.0                                                         | NUnit reports with real assertion counts                                                        |
| Unity CLI            | `C:\Users\jacob\AppData\Local\Unity\bin\unity.exe`, tool version 1.0.0                   | Real EditMode run through the CLI adapter with explicit editor path                             |
| Unreal Engine        | `D:\Unreal\UE_5.8`, Build.version 5.8.3                                                  | C++ Editor compilation, Python map authoring, editor Automation, UAT BuildCookRun, built player |
| C++ toolchain        | Visual Studio Community 2026; MSVC 14.50.35739, Windows SDK 10.0.22621.0 selected by UBT | Editor and Development game targets                                                             |
| Host/target          | Windows 11 x64 / Win64                                                                   | Headless runtime; Unity `-nographics`, Unreal `-nullrhi`                                        |

The current fixture pins Unity 6000.6.0f1 and Unreal 5.8 with V7 build settings and the Unreal5_8 include order. Path overrides locate another copy of these installations; they do not establish support for other versions. Installed Unity playback support also includes Linux and WebGL, but neither export target was accepted here. Unreal SDK validation reports Win64 available and other platform SDKs unavailable; those targets are outside this accepted matrix.

## Acceptance results

| Check                                                         | Unity                                                                                                   | Unreal                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Actual project identity and selected installed editor version | Pass                                                                                                    | Pass                                                                                            |
| Editor compilation/import prerequisite                        | Pass                                                                                                    | Pass; custom C++ runtime module compiled                                                        |
| Editor-integrated assertions                                  | 2 EditMode tests: save/load restoration and missing-save rejection                                      | 2 Automation tests: checkpoint persistence and actor spawn/destroy/respawn                      |
| Runtime in editor                                             | 2 PlayMode tests: respawn restoration and dynamic Rigidbody movement                                    | Actor lifecycle exercised in an engine-owned test world; packaged BeginPlay separately verified |
| Non-empty completed reports                                   | NUnit XML, 2 passed per suite                                                                           | Automation JSON, 2 succeeded, 0 failed/incomplete                                               |
| Windows Development packaging                                 | Pass; built scene via BuildPipeline and BuildReport                                                     | Pass; compile, cook, stage, pak, archive through UAT                                            |
| Packaged player execution                                     | Pass; 3 assertions for destroyed first instance, health and position restored in a replacement instance | Pass; 3 checks for actual save success, restored health and position in map BeginPlay           |
| CLI adapter                                                   | Unity CLI 1.0.0 executes 2 real EditMode tests using Editor 6000.6.0f1                                  | UAT and UnrealEditor-Cmd exercised through brokered operations                                  |
| Zero-match filter                                             | Rejected as failed despite process exit 0                                                               | Rejected as failed despite process exit 0 and no exported report                                |
| Access mode Restricted with workspace writes excluded         | Denied; persisted denied run has no command or process artifacts                                        | Denied; persisted denied run has no command or process artifacts                                |
| Ask always, denial                                            | Denied via an explicit pending approval                                                                 | Denied via an explicit pending approval                                                         |
| Ask always, approval                                          | Approved operation runs real tests successfully                                                         | Approved operation runs real tests successfully                                                 |
| Full access                                                   | Actual tests and build pass                                                                             | Actual tests and package pass                                                                   |
| Missing native project identity                               | Execution rejected                                                                                      | Execution rejected                                                                              |
| Requested engine-family mismatch                              | Rejected                                                                                                | Rejected                                                                                        |
| Preferred-version mismatch                                    | Capability reports mismatch and Engine board thread                                                     | Capability reports mismatch and Engine board thread                                             |

Restricted mode normally permits workspace writes. This acceptance explicitly changes its allowed side effects to `none` and `internal-write`; it does not claim the default Restricted policy blocks all builds/tests. Version mismatch is a reporting policy, not an execution denial. Project trust, worker role ceilings, and MCP bridge policies retain their separate repository tests; this matrix does not describe those as live engine acceptance.

## Defects reproduced and repaired

- Unity's original asynchronous test command included `-quit`. A direct run returned 0 without producing test XML. The connector now leaves test shutdown to the runner, forwards a test filter, and supplies the result path once.
- Test success previously depended on process exit alone. Unity and Unreal now require bounded, readable, non-empty completed reports with consistent result counts and successful test cases. Missing, malformed, truncated, failed, or unfinished results fail acceptance. Reports are retained as run artifacts.
- Unreal attempted `-run=Automation`; the installed engine reported that `AutomationCommandlet` could not be found. Tests now use editor automation with the queue-completion exit condition and a report directory. Engine logs are stored per run, and console separators in filters are rejected before execution.
- Native Windows launches omitted environment directories Unity Package Manager needs, causing its IPC startup to fail. The runner now passes an explicit Windows directory/toolchain allowlist and run-specific TEMP/TMP, while unrelated provider credentials remain excluded.
- The installed Unity CLI rejected the previous `--project-path` syntax. Its adapter now uses positional projects, `--mode`, `--output`, build target/method flags, and the CLI's batch `run` entrypoint. Explicitly registered Editors take priority. CLI tool version is separate from editor-version evidence, and Windows candidate paths are deduplicated case-insensitively.
- Ready Unity/Unreal capabilities incorrectly retained missing-installation explanations. Available operations now report a null unavailability reason, covered by connector tests and the live capability check.
- Live adapter switching exposed that removing an installation only invalidated reports without deleting its record. Removal now deletes the registration and invalidates capabilities; regression and live CLI switching cover the correction.

Fixture development also exposed two test-harness errors: double initialization of an Unreal world and a non-idempotent map creation script. Both were corrected. A later map recheck verifies the existing map contains exactly one acceptance Actor and saves it. The initial errors remain distinct from platform defects.

The command workflows were checked against installed engine headers/source, CLI help, [Unity's command-line test documentation](https://docs.unity.com/en-us/engine/6000.3/manual/scripting/test-framework-introduction/running-tests/run-tests-from-command-line), and [Epic's Unreal 5.8 automation documentation](https://dev.epicgames.com/documentation/unreal-engine/run-automation-tests-in-unreal-engine?lang=en-US). The Unity web page is edition 6000.3; actual execution evidence here is 6000.6.0f1 with Test Framework 1.8.0.

## Reproduction and artifacts

Run these commands with **native Windows Node 24**, after installing dependencies and building the platform service. Execute stages sequentially: they use the same isolated named-pipe profile. Do not open these fixture projects in another editor during the run.

```text
node scripts/live-engine-acceptance.cjs compile-unreal
node scripts/live-engine-acceptance.cjs map-unreal
node scripts/live-engine-acceptance.cjs access
node scripts/live-engine-acceptance.cjs tests
node scripts/live-engine-acceptance.cjs cli-unity
node scripts/live-engine-acceptance.cjs package
node scripts/live-engine-acceptance.cjs player
```

The first invocation creates dedicated Projects and a profile beneath `.turbo/live-engine-acceptance/`, copies the source fixtures, and registers the three real engine entrypoints. `GC_ACCEPTANCE_UNITY` overrides the Editor executable; `GC_ACCEPTANCE_UNREAL` overrides the engine root. The runner never discovers and edits an existing user game. Stages reuse their generated projects, close their service/client, preserve engine-run records, and report failure with a nonzero exit status. Keep failed first-run evidence before rerunning a stage, since stage summaries/logs reuse their filenames.

Reviewable local evidence is under [the acceptance directory](../.turbo/live-engine-acceptance): stage JSON records, exact argument arrays, process logs, original Unity/Unreal command reproductions, and fixture development failures. Brokered operations retain per-run XML/JSON, Editor logs and process artifacts in each Project's `.gamecrafter/engine-runs/`. Unity's built player is under `projects/unity/game/Build/`; Unreal's packaged archive is inside its successful build run. Both players write `player-acceptance.json` with the asserted results. Generated artifacts are local and ignored by Git; fixture sources and this report are the reproducible repository evidence.

## Remaining acceptance scope

C04 remains Verify for other engine versions, operating systems, target SDKs, graphics/input/audio behavior, interactive engine MCP bridges, arbitrary production projects, and the complete operation matrix. This acceptance verifies selected workflows represented in the Unity, Unreal and engine integration skills; it does not certify all 30 bundled skills or their asset/DCC workflows.

## Repository regression gate

Fresh dependency installation and all 33 Turbo build/typecheck/lint/test tasks pass on both OS targets: 424 Linux tests, and 412 native Windows tests with 12 explicit OS/capability skips. Both application targets build. Formatting, runner syntax, local documentation links and diff whitespace checks pass. These repository test counts are separate from the real Unity/Unreal fixture assertions above. Local `verification.json` and retained gate logs identify the final checks.
