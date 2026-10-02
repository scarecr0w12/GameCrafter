# GameCrafter operations and recovery guide

**Last updated:** 2026-10-01

**Audience:** Local administrators and maintainers. [Documentation index](README.md).

## Profiles and data locations

A profile contains platform settings, registered Projects, account metadata, encrypted credentials, service authentication/lifecycle files and logs. Multiple profiles are independent; a Project registered in one profile is not automatically registered in another.

| Item     | Linux default                                              | Windows default                                                     |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Profile  | `$XDG_CONFIG_HOME/gamecrafter`, or `~/.config/gamecrafter` | `%APPDATA%\GameCrafter`, or the user's roaming AppData fallback     |
| Database | `profile.sqlite` under the profile                         | Same filename under the profile                                     |
| Token    | `service.token` under the profile                          | Same filename under the profile                                     |
| Lock     | `service.lock` under the profile                           | Same filename under the profile                                     |
| Logs     | `logs/` under the profile                                  | `logs\` under the profile                                           |
| Endpoint | Runtime directory's `service.sock`                         | Named pipe derived from a SHA-256 hash of the resolved profile path |

On Linux without a profile override, the runtime directory is `$XDG_RUNTIME_DIR/gamecrafter` when provided, otherwise `<profile>/run`. With `GAMECRAFTER_PROFILE_DIR`, Linux uses `<profile>/run`. Windows uses a named pipe rather than a filesystem socket.

Set `GAMECRAFTER_PROFILE_DIR` before starting the service and Control Room. Use an absolute host-native path. A Windows process expects a Windows path; a Linux process expects a Linux path. Changing the environment of a new shell does not move an already running daemon to a different profile.

Profile credential encryption uses a local `credentials.key`. Protect the profile directory and key together. A missing key cannot decrypt previous ciphertext; generating a different key is not credential recovery. A redacted settings export does not replace a complete recovery plan.

## Service lifecycle

The Control Room starts the daemon automatically if needed. From a built checkout, use:

```bash
node packages/platform-service/lib/cli.js start
node packages/platform-service/lib/cli.js status
node packages/platform-service/lib/cli.js stop
```

The workspace binary is named `gamecrafter-service`, with the same commands when installed/available on PATH. Foreground operation is useful for diagnostics:

```bash
node packages/platform-service/lib/cli.js start --foreground
```

Detached start waits for a live lock owner and responsive endpoint. Status prints the PID and endpoint when running and returns exit code 3 when not running. Invalid CLI usage returns exit code 2. Stop authenticates and requests checkpointed shutdown, then waits for lock removal.

Linux isolated example:

```bash
export GAMECRAFTER_PROFILE_DIR=/absolute/path/to/isolated-profile
node packages/platform-service/lib/cli.js start
node packages/platform-service/lib/cli.js status
```

PowerShell isolated example:

```powershell
$env:GAMECRAFTER_PROFILE_DIR = 'E:\GameCrafterProfiles\isolated'
node packages/platform-service/lib/cli.js start
node packages/platform-service/lib/cli.js status
```

Do not stop unrelated user processes while cleaning up a test. Use the explicit profile and the recorded process ownership. Tool runners enforce timeouts and owned process-tree cleanup; external editors can have separate lifecycle defects.

`window.closeBehavior` defaults to `continue`. Selecting `stop-and-checkpoint` changes the intended close behavior. Verify the service status after closing when diagnosing background execution; a closed window is not itself a stopped service.

## Routine health checks

Confirm the profile and service status, then call `service/info` through the typed client. Compare the intended Project ID/path, engine family and current capability report before executing engine work. Inspect failing task/run/call records rather than relying only on a transient UI toast.

Useful records include task events/questions/checkpoints, tool calls/approval decisions, model usage/route decisions, MCP connection state, engine/DCC run logs, asset job state, backup runs and update verification state. Audit & History exports a selected page of call history. Settings export is redacted.

Keep diagnostic bundles narrowly scoped and sanitized. Provider errors have redaction coverage, but arbitrary third-party log text can still contain sensitive inputs. Do not publish profile tokens, credential keys, recovery secrets, raw credentials or private game content with a GitHub issue.

## Backups and restoration

Backups supports profile and Project scopes, local/S3/FTP/Google Drive destination configurations, manual/interval/daily plans, retention and recorded verification. Remote adapters have fixture coverage; native Windows local Project/profile restore has actual evidence.

A backup run records states such as running, uploading, verifying, verified, failed and cancelled. Verify the run, manifest and archive availability before depending on it. Schedule configuration alone does not prove a restorable archive exists.

For a recovery drill:

1. Create and verify a backup of the intended profile or Project.
2. Keep its recovery secret independently retrievable.
3. Restore through the supported flow into an empty destination.
4. Inspect the returned manifest, warnings and registration identity.
5. Open the restored Project or launch the service with the restored profile.
6. Check representative design files, engine identity, settings and persisted records.
7. Run appropriate engine or service checks before treating recovery as accepted.

The restore service rejects a nonempty target and uses a staging directory. It does not overwrite the running profile or perform in-place game recovery. A registered Project restore can allocate a new ID when the original is already registered elsewhere; the result includes `registeredProjectId` and warnings.

For a restored profile, stop the service using the old profile environment, set `GAMECRAFTER_PROFILE_DIR` to the restored destination, and start the service there. Recheck accounts and plugin versions. The restore result warns when installed plugin versions differ from the archive's recorded versions.

Copying a live SQLite main file manually is not equivalent to the supported consistent snapshot path. Engine-derived caches can be recreated, but authoritative assets/documents and operational records require an explicit preservation decision.

## Releases and update verification

Build scripts are in the desktop package:

```bash
npm run package:linux -w @gamecrafter/control-room
npm run package:win -w @gamecrafter/control-room
npm run package:dir -w @gamecrafter/control-room
```

Run the appropriate native host/toolchain. Windows packaging includes a native binary verification script. A package directory build is useful for launch testing; it is a different result from installer acceptance.

The update service distinguishes available release metadata, compatibility, download checksum, signature availability/validity and installation. A trusted Ed25519 public key must be provisioned for signature verification. With no public key configured, signature status is unavailable; a configured key with a missing/invalid signature fails verification.

The [release guide](RELEASE_GUIDE.md) describes the tagged testing-prerelease workflow and versioned local Windows launcher. Current evidence includes local Linux artifacts, a native Windows x64 NSIS artifact, startup/service behavior and hosted package workflows. Installer install/uninstall, previous-installer capture, signing-key provisioning, tagged signed release and rollback validation remain open in WP19. Do not describe the system as having accepted unattended update/rollback until those tests exist.

Generated installers and Windows release staging directories stay local/ignored. Publish distribution artifacts through the release workflow after validation; Git source commits should contain sources and reproducible build scripts.

## Dependency audit and GitHub alerts

Run a fresh dependency audit from the native dependency environment:

```bash
npm audit --json
```

On 2026-10-01 the local lockfile audit reports **6 low, 40 moderate, zero high and zero critical** findings. The initial GitHub push reported 34 open Dependabot alerts, including high/critical entries. After GitHub processed the implementation commit, a fresh API query reports **20 open alerts: 15 medium, 5 low, zero high and zero critical**. Local npm and GitHub counts come from separate systems and are not directly interchangeable.

Use [GitHub Dependabot alerts](https://github.com/scarecr0w12/GameCrafter/security/dependabot) and the currently resolved lockfile/code to evaluate each alert. A scanner can take time to process a new commit; a workspace replacement/override can also require code-path analysis. Remaining lower-severity local findings are not a zero-vulnerability claim. Alerts must be triaged and validated before dismissal.

## Troubleshooting

| Symptom                                      | Inspect                                                                           | Recovery or next check                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Control Room cannot connect                  | Profile environment, CLI status, lock owner, endpoint and token paths             | Launch with the same profile; inspect startup failure before removing any lifecycle file      |
| CLI status says not running                  | PID liveness and selected profile                                                 | Start that profile; do not assume another profile's daemon is the target                      |
| Authentication/protocol failure              | Client discovery path and service/client versions                                 | Use the matching profile and built client; never copy a token into logs                       |
| Electron native module failure               | OS binary format, Electron ABI and last install/rebuild environment               | Reinstall/rebuild in the native checkout; keep Windows and Linux dependencies separate        |
| A tool is denied                             | Audit decision, effective mode, minimum mode, task/request ceilings and allowlist | Adjust only the intended policy after reviewing side effects; retry explicitly                |
| A tool waits indefinitely                    | Approval/question state and configured timeout                                    | Answer the prompt or cancel the owning task; inspect persisted timeout/restart result         |
| Engine is detected but operation unavailable | Project-file/headless/live layer and native project files                         | Configure the missing layer; detection alone is insufficient                                  |
| Editor identity mismatch                     | Current native Project and bridge identity reply                                  | Open/bind the correct editor; never bypass identity with a nearby path                        |
| Screenshot returns a failed run              | Broker decision, tool result, PNG path/type/size/containment                      | Collect an actual image within the permitted Project; a success message alone is insufficient |
| Engine tests exit zero but fail              | Parsed test report and failure count                                              | Repair the engine test; exit code alone is not acceptance                                     |
| MCP cannot connect                           | Command/cwd/environment or endpoint transport, negotiated revision and timeout    | Reproduce the server launch under the configured host environment                             |
| Unity Pipeline quit fails                    | External CLI/editor log and owned fixture process                                 | Record the bridge defect and clean up only the owned test editor                              |
| CodeFizz discovery misses the editor         | Bridge port record and CLI health identity                                        | Use an observed port only after validating the exact Project identity                         |
| Asset job is submitted but no file exists    | Terminal provider state, download/import record                                   | Wait/retrieve/inspect; submission is incomplete                                               |
| Knowledge search is stale                    | Source documents, indexing state and embedding provider                           | Reindex appropriate sources and retain source citations                                       |
| Restore rejects a destination                | Target exists/nonempty and backup identity                                        | Choose an empty destination; inspect warnings after restore                                   |
| Signature unavailable                        | Configured public key and release assets                                          | Provision trusted verification material; do not label unavailable as verified                 |
| Isolation tests skip or plugin cannot start  | Bubblewrap/namespace capability or unsupported Windows isolation                  | Report the precise capability; preserve fail-closed behavior                                  |

## Incident evidence

For a reproducible defect, collect the commit, OS/Node/Electron versions, Project ID/path (sanitize when private), engine/connector version, operation name, run/task/call ID, timestamps, status, relevant log excerpt and expected versus actual behavior. Preserve the original failure artifact before retrying.

Live acceptance artifacts live under `.turbo/live-engine-acceptance` and `.turbo/extended-engine-acceptance`. Their paths are local evidence locations, not downloadable artifacts in a source-only clone. Versioned acceptance documents summarize the results and link the runners/source fixtures.

Current limitations are maintained in [status](STATUS.md). Production-game validation, physical Windows input/navigation, broader engine target matrices, live model/generation providers, remote backup recovery and release lifecycle need separate acceptance.
