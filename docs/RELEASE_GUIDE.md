# GameCrafter versioning, releases and local Windows testing

**Last updated:** 2026-10-01

This guide defines the current release tooling and the local testing handoff. The complete release lifecycle remains in progress in [WP19](DEVELOPMENT_PLAN.md#wp19--packaging-and-release); installer upgrade/rollback and signing acceptance are separate from producing a test build.

## Version and tag contract

All nine first-party application/package workspaces use the same exact release version and exact internal dependency versions. The npm lockfile must record those versions. An annotated Git tag has the form `v<version>` and identifies the immutable source commit used for the build. A release tag must match the desktop application's version.

The release preparation scripts are [set-release-version.cjs](../scripts/set-release-version.cjs) and [check-release-version.cjs](../scripts/check-release-version.cjs). Version checking runs in normal CI and before release packaging. It rejects stale workspace/lockfile versions and mismatched tags.

For example, prepare the next testing version from a clean checkout:

```bash
npm run release:version -- 0.1.2
npm install --package-lock-only --ignore-scripts
node scripts/check-release-version.cjs v0.1.2
npm ci
npx turbo run build typecheck lint test
node scripts/generate-system-reference.cjs --check
npm run format:check
bash scripts/check-links.sh
```

Run dependency installation in the native host checkout. Linux and Windows native dependencies must remain separate. Review and commit the version/lockfile/documentation changes before creating the tag. Do not move or reuse a published tag when repairing a release; create a new version.

## GitHub release workflow

[Desktop Release](../.github/workflows/release.yml) runs when a `v*` tag is pushed, or manually for package-only verification. The workflow checks version agreement, runs dependency package quality checks, builds native Windows/Linux packages, verifies the Windows contents, uploads build artifacts and assembles release metadata.

A tagged workflow creates a **draft testing prerelease**. It does not automatically publish a stable update. GitHub's prerelease flag is the testing-channel designation; it can be used with a normal semantic version such as `0.1.1`. The current in-app update channel is stable and excludes testing prereleases, so testing versions are obtained manually.

The draft contains Windows NSIS `.exe`, Linux AppImage/DEB, `gamecrafter-release.json` and `SHA256SUMS.txt`. The manifest records the version, tag, commit, timestamps, platform assets/hashes and profile/Project schema compatibility.

If `UPDATE_SIGNING_PRIVATE_KEY` is configured, metadata/checksums are signed with Ed25519. Without that secret, the workflow explicitly authorizes an unsigned testing prerelease and labels its manifest accordingly. Ordinary metadata generation still requires a signing key. A checksum proves file integrity against the listed hash; it is not publisher authentication.

Windows Authenticode signing uses separate `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets. No signing certificate/key is generated or uploaded automatically. A testing executable can therefore be unsigned even when Ed25519 release metadata is signed.

After reviewing successful checks and actual artifacts, publish the authorized testing prerelease:

```bash
git tag -a v0.1.2 -m 'GameCrafter 0.1.2 testing prerelease'
git push origin main
git push origin v0.1.2
# Wait for the Desktop Release workflow and inspect its draft assets.
gh release edit v0.1.2 --draft=false --prerelease --latest=false
```

Publishing is a separate operation requiring release authority. Do not convert to a stable release without reviewing signing, supported installation/update paths and the remaining acceptance requirements. Use the actual release version in every command.

## Local Windows executable

Build from native Windows Node/npm after package checks:

```bash
npm run package:win -w @gamecrafter/control-room
node scripts/stage-windows-release.cjs
```

Electron Builder writes to `apps/control-room/dist/<version>/`. This preserves previous version outputs and avoids packaging over a running app's directory. Close the owned application from that version before rebuilding the same directory; Windows can lock native modules.

The Windows verifier checks the Electron main entry, PE native module, matching application/service versions, all thirty current bundled skills and their reference content, and Apache license/notice files. It rejects missing or stale skill assets, so a test package cannot silently substitute an older skill library.

The staging command creates:

```text
Windows-Release/<version>/
  GameCrafter-<version>-x64.exe    NSIS installer
  Launch-GameCrafter-Test.cmd     Launch the unpacked app with isolated test state
  app/GameCrafter.exe            Actual unpacked desktop executable
  app/resources/...             Required runtime files, service, skills and plugins
  local-build.json               Version, tag, source commit and installer hash
  SHA256SUMS.txt                 Local installer checksum
```

Keep the complete `app/` directory together. Its executable requires the adjacent runtime files. The installer is a separate executable that installs the application.

Double-click `Launch-GameCrafter-Test.cmd` for an isolated local test. It sets the profile, Theia configuration and Electron user-data directories below `%LOCALAPPDATA%\GameCrafter-Testing`, separated by version. The launcher preserves the normal GameCrafter profile. Launching `app/GameCrafter.exe` directly uses the application's ordinary environment/profile resolution instead.

Staging rejects an existing `Windows-Release/<version>` destination so previous evidence/builds are preserved. It does not delete or overwrite an earlier version. Installers, unpacked apps, credentials and generated test artifacts remain ignored by Git.

## Test the packaged application

Use an isolated profile/configuration, launch the unpacked app outside the development Electron process, and verify startup, Project creation/opening, Settings, Models, Chat, Skills & Roles, Connections, Board, Swarm, Plugins, Engine/DCC, Knowledge, Assets, Backups, Updates and Audit.

For automated packaged UI smoke, launch with a local Chrome DevTools port and run:

```bash
node scripts/live-ui-smoke.cjs --electron
```

Configure `GAMECRAFTER_CDP_URL` and `GAMECRAFTER_SMOKE_ARTIFACT_DIR` for that owned test session. Close only the session and service created by the test. An unpacked executable smoke is not installer install/uninstall acceptance or an upgrade/rollback drill.

Inspect the packaged service over authenticated RPC as well: check `service/info`, create a disposable Project, list the thirty builtin skills, activate an appropriate guide and read its reference. This confirms the shipped runtime can use the library, rather than only confirming source files exist.

## Release evidence and limitations

Keep quality logs, package logs, screenshots, UI reports, metadata/checksum verification and the exact GitHub workflow/tag IDs with each build. Source fixtures and sanitized records are versioned; generated artifacts live in ignored local output or GitHub release assets.

Testing prereleases do not certify production games, every engine version, live provider accounts, installer rollback or Windows plugin isolation. Read [status](STATUS.md), [operations](OPERATIONS_GUIDE.md), and the version's [release notes](releases/v0.1.1.md) for the current boundary.

The publication and packaging mechanisms above are documented by [GitHub release management](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) and [Electron Builder v26 target selection](https://www.electron.build/v26/docs/targets/). Repository scripts and test evidence determine GameCrafter's actual behavior.
