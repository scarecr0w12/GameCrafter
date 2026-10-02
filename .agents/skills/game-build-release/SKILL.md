---
name: game-build-release
description: "Prepare and validate packaged game builds, distribution branches, store readiness, update/save compatibility, and release evidence. Use for game packaging or release preparation; perform publication only within explicit task authorization and supported platform access."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Game build release

Produce a traceable packaged artifact with concrete readiness evidence and a deliberate distribution action.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Engine/version, target platform, build profile, distribution channel, and version identifier.
- Signing/packaging prerequisites, required content, save format, and store promises.
- Task authorization for uploads/publication and available platform accounts/tools.

## Procedure

### 1. Define the artifact

- Name target OS/architecture, version, content set, and release configuration.
- Record source revision and dependencies so reviewers can trace the build.

### 2. Inspect packaging requirements

- Read current official requirements for the selected platform and installed engine.
- Record unavailable restricted documentation without guessing certification rules.

### 3. Build reproducibly

- Use repository-supported commands and isolate generated outputs.
- Record commands, logs, result location, and any manual packaging step.

### 4. Inspect packaged contents

- Check executables, required assets, locale data, dependencies, and debug leftovers.
- Include relevant license/provenance notices; avoid exposing credentials in artifacts.

### 5. Run clean installation

- Launch outside the development environment on a representative target.
- Check first-run setup, input, audio, graphics, menus, and graceful exit.

### 6. Check state compatibility

- Test save/load, settings, version upgrade, and failure recovery.
- Preserve user data and define behavior for unsupported or corrupt saves.

### 7. Exercise distribution testing

- Use the selected channel’s private testing or beta branch facilities when authorized.
- Keep public-default updates and internal test uploads distinct.

### 8. Review release promises

- Compare store description, screenshots, controls, platform support, and actual build.
- Prepare submission evidence and open issues with player-facing implications.

### 9. Prepare the release action

- Identify exact artifact/branch/account and the effect of the publish control.
- Carry existing user authorization forward; ask only when publication authority is missing.

### 10. Report readiness honestly

- Deliver artifact identifiers, test evidence, remaining blockers, and rollback approach.
- A local packaged build does not establish store review approval or console certification.

## Deliverables

- Versioned artifact, manifest, build command/log, and source revision.
- Install/start/update/save compatibility evidence.
- Store readiness record and exact proposed or completed distribution action.

## Completion review

- Artifact can start on the representative target outside the editor.
- Required content and promised supported modes are included.
- Save/settings upgrades have an explicit verified or unverified status.
- Upload, review approval, and publication are reported as separate states.

## Gotchas

- Setting a live default branch can distribute an update to existing players.
- A successful development build is not a release-profile validation.
- Store account permissions and review state can block release independently of code.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [Builds, manifests, beta branches, and live update behavior](https://partner.steamgames.com/doc/store/application/builds?l=english).
- [Store and build review versus explicit release](https://partner.steamgames.com/doc/store/releasing?l=english).
