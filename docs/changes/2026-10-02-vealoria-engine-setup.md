# Verify and configure Vealoria's live engine setup

**Release:** 0.2.0

**Impact:** none

**Category:** Maintenance

## Summary

Verified the installed PlayWeld 0.1.4 application against the open Vealoria Unreal 5.8.3 editor, restored a working live bridge, and corrected Vealoria's GameFeatureData startup configuration error. This is local setup and investigation evidence, with no shipped PlayWeld source change.

## Details

- Inspected the actual desktop application, service RPC responses, running editor process, project manifest, native project, engine configuration and logs. Initial live readiness was unavailable because the bound `unreal` connection was disconnected.
- Connected the existing project-scoped `cfa-unreal` MCP connection, explicitly selected Vealoria in CodeFizz, and bound it through `engine/setLiveBridge`. Refreshed project-file, headless-process and live-editor readiness all reported ready; the bridge identified the native Vealoria project path.
- Selected Vealoria in the desktop chat Project selector and opened the Engine view. Observed a separate Swarm provider context-limit failure, left unresolved within this engine setup task.
- External project file changed: `E:/GameCrafter-Dev/vealoria/game/Vealoria/Config/DefaultGame.ini`. Added the missing GameFeatureData Asset Manager rule following installed Unreal GameFeaturesEditor source defaults and applied it to the running editor default settings. Existing asset rules remain. External evidence document added: `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP.md`.
- Local operational changes are persisted through the platform service and CodeFizz selection; no SQLite files were edited directly. No app/engine/plugin installation, version change, removals, public contract change or migration was performed. No maps or game assets were saved.
- Initial Python reflection attempts failed without changing settings; using native reflected property names succeeded. The first DataValidation run reproduced the original startup failure; the corrected fresh process passed.

## Validation

- Live platform-service identity and capabilities queries against the installed app: all three engine layers ready; CodeFizz MCP negotiated 2025-11-25 and exposed 15 tools.
- Live screenshot through `engine/run` and the platform broker succeeded: run `01a0feb2-8630-7dd5-8ea8-671e6436acae`, with screenshot under Vealoria's matching `.gamecrafter/engine-runs/` directory.
- Pre-correction DataValidation run `01a0feb4-c805-72e6-94f3-bd4b26d47b2b` exited 1 with the missing GameFeatureData rule. Corrected run `01a0feb5-9f2d-7fbc-a28d-209139378943` exited 0; editor.log reports 0 errors and 1 MLAdapter warning. Only one asset was validated, so this is startup/configuration evidence, not game-content coverage.
- The current map is unsaved `/Temp/Untitled_1`. Gameplay, multiplayer, builds, dedicated server, plugin update, editor restart and game-feature activation were not tested.
- `npm run changelog:update`, `npm run changelog:check -- --base HEAD`, and `npm run format:check` passed. Code build/typecheck/lint/test was skipped because no repository executable source changed.
- Ran `scripts/check-links.sh` using Git Bash; it emitted no result and was stopped after a three-minute verification limit. Repository-wide documentation link verification is incomplete. The new record introduces no Markdown links.

## Files

- `docs/changes/2026-10-02-vealoria-engine-setup.md`
