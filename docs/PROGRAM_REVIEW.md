# GameCrafter program review and local verification

**Last updated:** 2026-10-01

This records a repository-grounded review, repairs, and local execution evidence. The complete target system and remaining implementation gaps remain in [STATUS.md](STATUS.md) and [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). Passing the local application tests does not complete every target-system requirement.

## Findings and repairs

| Finding | Repair | Evidence |
| --- | --- | --- |
| Many service integration tests forced Linux sockets on Windows, failing before reaching the feature. | Use native platform paths in integration tests; explicitly use POSIX/Windows path implementations when testing a selected OS. | Named-pipe Project lifecycle, chat persistence, session settings, tasks, approvals, board maintenance, knowledge, and coordination tests. |
| Native process launchers could not reliably execute Windows batch files and shebang scripts. | Pin `cross-spawn` 7.0.6; use it for engine/DCC processes, version probes, IPC stdio launchers, Docker commands, and configured authoring-tool launchers. Capture probe output with size and time limits. | Actual Windows `.cmd` argument-preservation test including spaces and shell metacharacters; fixture adapter tests; native Blender execution. |
| Windows fixture behavior depended on case-sensitive filenames, Git line-ending settings, Unix `echo`, and Linux-only availability assertions. | Separate Unity CLI/editor fixture paths, disable automatic CRLF conversion in isolated Git fixtures, use the Node executable for the broker process test, and assert OS-specific DCC readiness. | Targeted Windows adapter, worktree, broker, board, and DCC integration tests. |
| Windows TCP teardown produced unhandled connection-reset errors in the fake FTP server. | Treat connection reset as fixture teardown while retaining failures for unexpected errors. | FTP destination integration test. |
| Project Home navigation was clipped in a narrow desktop dock. | Wrap navigation buttons, make Project Home scroll, and give the Project table its own horizontal overflow. | Reproduced in the native Electron window; repaired desktop smoke test passes at its actual default window size. |
| Windows CI ran only the client test, and UI testing was manual. | Run the full quality gate on both OS targets; add a pinned Puppeteer development dependency and `npm run test:ui`. | Local Windows gate and repeatable browser/Electron UI script. The changed hosted CI workflow has not run in this session. |

## Live UI evidence

`scripts/live-ui-smoke.cjs` passed on the built browser app, native Windows development Electron app, and freshly packaged Windows executable. Each run verified sixteen checks: connection to the real local platform service, the six-step Project creation wizard, Settings, Models, Chat, Skills & Roles, Connections, Discussion Board, Swarm, Plugins, Engine, DCC Tools, Knowledge, Assets, Backups, and opening the created Project in the existing window. All three recorded zero renderer exceptions. The script accepts workspace trust only for its generated disposable Project folders, without disabling the application's trust guard.

The test creates real disposable Projects under `.turbo/live-projects/`. Runtime profiles and screenshot/report artifacts are under `.turbo/`; they are ignored by Git. Results are `.turbo/live-browser/report.json`, `.turbo/live-electron/report.json`, and `.turbo/live-packaged/report.json`. Screenshots sit beside those reports. Model/provider-backed operations were not exercised by this UI smoke test.

To repeat the browser test, build and start `@gamecrafter/control-room-browser` on `http://127.0.0.1:3000`, then run `npm run test:ui`. Set `GAMECRAFTER_PROFILE_DIR` and `THEIA_CONFIG_DIR` on the server process to isolated test directories. `GAMECRAFTER_SMOKE_URL` selects another browser URL.

To repeat the desktop test, build `@gamecrafter/control-room`, launch its Electron application with `--remote-debugging-port=9222`, then run `npm run test:ui -- --electron`. `GAMECRAFTER_CDP_URL` selects another local debugging port. The script disconnects from the desktop debugging session and leaves the test window open. Close the app before rebuilding: Windows locks the running terminal addon.

## Native service and DCC evidence

The native Windows local backup integration tests create encrypted archives, verify hashes, restore Project and profile state, preserve encrypted credentials, and include an 8 MiB asset. This verifies local recovery on this host. Remote S3, FTP, and Google Drive destinations remain tested against fixture services.

The installed Blender at `D:/Blender/blender.exe` passed the real DCC connector test for scene creation, saved-scene inspection, GLB export, and PNG rendering through the service's named-pipe RPC. This is native Windows headless evidence. It does not verify a live Blender editor bridge.

## Build and package evidence

After `npm ci`, the final `npx turbo run build typecheck lint test` completed all 29 tasks successfully. Tests recorded 377 passes and nine capability-dependent skips: 293 service tests, 64 contracts tests, 17 Theia extension tests, and one each in the client, plugin SDK, and sample plugin. The application typecheck/lint/test tasks retain their existing skip configuration; the real Electron and browser application builds passed. `npm run format:check`, `git diff --check`, and `scripts/check-links.sh` passed. Logs are retained under `.turbo/`.

The fresh unsigned NSIS installer is `apps/control-room/dist/verified-windows/GameCrafter-0.1.0-x64.exe` (198,889,501 bytes). Its SHA-256 is `EFD32A498EF1CE1FD72E7FA23D9C8333014E7FFC94AD1AB965EEF2B4F7AA311F`. The packaged native-module check passed, and the adjacent `win-unpacked/GameCrafter.exe` passed the live UI smoke test. NSIS installation/uninstallation and upgrade/rollback were not exercised. A first packaging attempt hit a transient Windows file lock in the default output; packaging into the isolated `dist/verified-windows` output succeeded.

## Remaining completion gaps

The locked dependency audit reports 50 advisories (one critical, three high, 42 moderate, and four low). These are npm advisory classifications, not demonstrated application exploit paths. The high/critical dependency entries include `decompress`, `electron`, `@theia/electron`, and `serialize-javascript`. npm's suggested fixes include incompatible Theia downgrades, so no automatic audit fix was applied. Dependency remediation remains open and should preserve the repository's single-version Theia constraint.

The Windows AppContainer launcher remains an explicit unavailable implementation. Restricted plugins fail closed there. Plugin signature verification, host-level egress filtering, and additional isolation layers remain incomplete.

WP19 remains in progress: previous-installer capture and rollback, trusted release-key provisioning, signed tagged release execution, and installer/update/rollback drills remain incomplete. An installer build alone does not establish installation or recovery behavior.

No live model provider, generation provider, Unity/Unreal operation, community editor MCP bridge, or remote backup provider was verified during this review. Their fake-tested status remains. Theia AI model integration, external IDE MCP integration, other documented engineering gaps, and user-owned open decisions remain tracked in the status and decision register.

## 2026-10-01 follow-up

The [full project review](FULL_PROJECT_REVIEW.md) records new defects, repairs, remaining work across all architectural areas, and current verification. The test counts, unsigned package, and live desktop/DCC reports above describe the earlier 2026-09-30 run; they are preserved as historical evidence. They do not validate newly changed source or resolve the release/isolation gaps.
