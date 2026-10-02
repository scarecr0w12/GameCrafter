# Game build release: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Prepare a Windows patch for Steam without publishing it.

**Initial investigation:** Build versioned content, test upgrade from the previous save, and inspect depots.

**Proposed action:** Upload to an authorized beta branch and collect installation/play evidence.

**Expected handoff:** Build/depot identifiers, compatibility report, and a concrete default-branch proposal.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Prepare a traceable package | Fresh install: Startup/menu/play/exit evidence. |
| Run clean installation and first use | Upgrade: Compatibility outcome and data preservation. |
| Verify upgrade and recovery | Packaged content: Manifest and representative coverage. |
| Inspect distribution and publication state | Distribution: Private test vs public publication explicitly identified. |

## Detailed scenarios

### 1. Prepare a traceable package

- Use a hypothetical Windows x64 patch 0.4.2 with a named source revision and release build configuration.

- Run the repository-supported build command and preserve logs, output path, artifact hash, and relevant dependency versions.

- Inspect executable, runtime dependencies, content, locales, notices, and accidental debug/test files.

- Check that signing or platform prerequisites are satisfied where applicable; label unavailable credentials/documentation explicitly.

- Compare the package with the intended content set rather than assuming every editor asset was included.

- Deliver a manifest and build provenance record without claiming store review approval.

### 2. Run clean installation and first use

- Install outside the editor and development dependency environment on a representative supported target.

- Test first launch, display setup, supported input, audio, menu navigation, one playable interaction, and graceful exit.

- Inspect logs for missing assets, fonts, shared libraries, or inaccessible writable locations.

- Relaunch after creating settings and a save; verify first-run initialization does not overwrite them.

- If the game starts only from a developer shell, diagnose environment and dependency assumptions before marking ready.

- Keep target configuration and startup/play/exit evidence with the exact packaged artifact identifier.

### 3. Verify upgrade and recovery

- Create a fixture with a save and settings from the previous supported build, including a checkpoint and changed input binding.

- Install the patch and load the existing record; inspect inventory, objectives, scene placement, and preferences.

- Test an unsupported newer save and a locally truncated copy; preserve originals and check user-facing recovery behavior.

- Interrupt a save/update only through supported local fixtures and inspect atomicity or rollback behavior.

- Choose compatibility policy explicitly when a migration cannot preserve meaning; do not silently reset player progress.

- Deliver versioned compatibility results and unresolved migration cases, separate from a successful fresh install.

### 4. Inspect distribution and publication state

- For an authorized Steam test upload, select the intended beta branch and record build/depot identifiers.

- If privacy is required, configure supported branch protection before making content available there.

- Install from that branch and compare the downloaded build with the candidate that was locally validated.

- Check store feature/platform promises against the build and identify missing account permissions or review state.

- Prepare the exact default-branch or publication operation and its player effect; use existing explicit authorization without inventing it.

- Report local artifact, uploaded test build, reviewed state, and published state independently.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Versioned artifact, manifest, build command/log, and source revision.
- Install/start/update/save compatibility evidence.
- Store readiness record and exact proposed or completed distribution action.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Artifact can start on the representative target outside the editor.
- Required content and promised supported modes are included.
- Save/settings upgrades have an explicit verified or unverified status.
- Upload, review approval, and publication are reported as separate states.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Builds, manifests, beta branches, and live update behavior](https://partner.steamgames.com/doc/store/application/builds?l=english).
- [Store and build review versus explicit release](https://partner.steamgames.com/doc/store/releasing?l=english).
