# Track all repository work and release details

**Release:** 0.2.0

**Impact:** none

**Category:** Maintenance

## Summary

Require permanent work records for all repository changes, generate a central changelog and detailed release notes, and enforce changed-file coverage and version impact before releases.

## Details

- Record the user's requirement in repository instructions and the design decision log. Document the workflow in the tracking contract, template, developer/release guides, documentation index, development plan and status. Cover additions, changes, removals, refactors, tests, documentation, investigations, research, dependencies, assets, configuration and reverted work.
- Introduce permanent Markdown records with summary, complete task details, exact affected paths, category, semantic version impact, and actual validation/limitations. Track deletions and both paths of renames; protect previously committed version-assigned records from edits/deletion. Reviewers remain responsible for factual and prose completeness. Include the root changelog in the documentation link checker.
- Generate the central changelog with full-record links, and collect summaries, details and validation into future version notes. Preserve earlier authored release notes and explicitly label the incomplete historical baseline, including the missing dedicated 0.1.3 note.
- Extend version preparation to check coverage/freshness, reject reused/nonadvancing versions, enforce the highest impact, assign all pending records, and create a separate record of workspace/lockfile version changes. Breaking changes before 1.0 require at least a minor bump; schema migrations remain separate. Keep version 0.1.4 while this maintenance work is pending.
- Add full-history CI file-coverage checks for PRs/pushes, tracking regression tests and generated-output freshness. Use the generated detailed note as the GitHub draft release body. Require a finalized ledger and new tracked version before desktop packaging or Windows staging. Prepared validation may be completed before commit; later evidence uses new work records.
- Add isolated Git-fixture regression coverage for untracked paths, staged/committed ranges, renames/deletions, incomplete fields, globs, stale generation, immutable history, packaging gates, impact checks, manual bypass attempts and existing tags. No new dependencies or compatibility-identifier renames are introduced. No installer, tag or release is created by this change.

## Validation

- `npm ci --foreground-scripts` completed on native Windows. The full Turborepo build/typecheck/lint/test run passed all 33 tasks (29 reused cached results), including Electron and browser builds.
- All 11 dedicated tracking regression tests passed against isolated Git repositories. Formatting, generated RPC/settings reference freshness, release-version agreement and full local changed-file coverage checks passed.
- The complete `scripts/check-links.sh` check passed in WSL, including the central changelog. `git diff --check` passed. A real release-gate invocation correctly rejected this pending ledger before packaging.
- Hosted CI/release wiring, native Windows packaging, Linux packaging and installer lifecycle have not been run for this maintenance change.

## Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `AGENTS.md`
- `README.md`
- `apps/control-room/package.json`
- `docs/DEVELOPER_GUIDE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/README.md`
- `docs/RELEASE_GUIDE.md`
- `docs/STATUS.md`
- `docs/changes/README.md`
- `docs/changes/TEMPLATE.md`
- `package.json`
- `scripts/set-release-version.cjs`
- `scripts/stage-windows-release.cjs`
- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`
- `scripts/check-links.sh`
