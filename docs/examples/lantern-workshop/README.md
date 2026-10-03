# Lantern Workshop reusable testing Project contents

This fixture supplies game and design files for the [worked tutorial](../../WORKED_TUTORIAL.md). Create a PlayWeld Project with the **Godot** family first, then copy this directory's `docs/` and `game/` contents into it. PlayWeld owns the destination manifest, Project ID, Git setup, repository instructions, and operational state; this fixture intentionally does not duplicate those records.

The [profile recovery runbook](../../RECOVERY_RUNBOOK.md) reuses its design files in a disposable Project. Run `node scripts/verify-documentation-recovery.cjs` from the built repository for index/diagnostics/profile restoration checks; [retained evidence](verification/profile-recovery.json) describes their precise scope.

The native game targets Godot 4 and uses only code-drawn shapes, the default UI actions, and the default font. It contains no downloaded art, credentials, paid integrations, or generated production assets. Its design is a tutorial example, not a user-confirmed product requirement.

Open `game/project.godot` in Godot. Move with arrow keys, collect three gold lanterns, and press R to reset. The expected behavior and acceptance checks are in [DESIGN.md](docs/DESIGN.md). Native gameplay must be tested separately from the Control Room capture; see the [coverage record](../../DOCUMENTATION_COVERAGE.md) for actual verification performed.

The [capture script](../../../scripts/capture-documentation.cjs) copies these files into a new disposable Project on each run. Edit the fixture first, rebuild application code when needed, then recapture. Do not check in `.godot/`, profile credentials, service tokens, local logs, or generated Project databases.

Run `node scripts/verify-documentation-native.cjs` from the repository root to import and exercise a copied fixture. It uses `GAMECRAFTER_DOC_GODOT` when provided; on Windows its default is installed WSL Godot. The [acceptance script](game/acceptance.gd) sets up a headless viewport and checks collection, duplicates, reset, movement and bounds. Current verification used Godot 4.7.2 in WSL; it is a native headless result, separate from browser screenshots and engine bridge readiness. Logs and a versioned JSON report remain under `.turbo/documentation-native`.

Companion [service examples report](verification/service-examples.json), [desktop smoke report](verification/electron-smoke.json) and [fresh Unity/Unreal report](verification/engine-acceptance.json) retain exact checks performed on isolated fixtures. Run `node scripts/verify-documentation-examples.cjs`, `node scripts/verify-documentation-electron.cjs` or `node scripts/verify-documentation-engines.cjs` from the built Windows workspace with the installed-tool prerequisites described in the contributor/engine guides. They do not modify production games or validate an installer.
