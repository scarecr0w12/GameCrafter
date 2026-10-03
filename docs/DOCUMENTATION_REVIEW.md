# Documentation review and acceptance boundaries

**Last reviewed:** 2026-10-02

Reviewed the documentation created in the Lantern Workshop work against current typed contracts, service implementation, Control Room navigation, capture scenarios and retained reports. The working tree starts at `4e1342070f56926807a5d1bb04d43b1a54f2ed40` and includes recorded pending documentation/runtime/tracking changes, with workspace version 0.4.0. This review does not prepare another release or turn historical installer evidence into current installer acceptance.

## Coverage result

The documentation covers the implementation's named surfaces and explains the main user, operator and contributor workflows. The [coverage inventory](DOCUMENTATION_COVERAGE.md) remains the owner of evidence gaps. Coverage of the complete target design includes explicit incomplete areas; it does not mean every target operation is implemented or live-verified.

| Area reviewed                    | Guide or artifact                                                                                                                                                                                             | Supported result and limit                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPC/contracts                    | [API reference](API_REFERENCE.md), [surface inventory](reference/DOCUMENTATION_INVENTORY.md), [service recipes](SERVICE_RECIPES.md)                                                                           | All 186 requests and 28 notifications enumerated; exact schemas linked. Inspection examples use existing contracts.                                                                   |
| Settings                         | [Settings reference](SETTINGS_REFERENCE.md), [workflow cookbook](WORKFLOW_COOKBOOK.md)                                                                                                                        | All 75 settings in 17 groups mapped; scope/inheritance/preview/reset and synthetic UI import/export explained. Exports do not recover credentials.                                    |
| Control Room                     | [Handbook](CONTROL_ROOM_HANDBOOK.md), [tutorial](WORKED_TUTORIAL.md), [gallery](WORKFLOW_SCREENSHOTS.md)                                                                                                      | All 16 navigation surfaces explained. Original overview and expanded operation captures remain distinguishable.                                                                       |
| Service/storage/lifecycle        | [Operations](OPERATIONS_GUIDE.md), [recovery runbook](RECOVERY_RUNBOOK.md), [architecture](SYSTEM_ARCHITECTURE.md)                                                                                            | All 24 source-directory areas have a guide/test mapping; current profile restart/restore/index recovery has service evidence. Older-schema/cross-OS breadth remains qualified.        |
| Requests/tasks/tools/integration | [Workflow cookbook](WORKFLOW_COOKBOOK.md), [agent report](images/lantern-agent/capture-report.json)                                                                                                           | Real UI/service questions, approvals, delegated worktree changes and integration passed with a scripted endpoint. Model reasoning and full conflict UI recovery remain separate gaps. |
| Models/router                    | [Routing guide](MODEL_ROUTING_GUIDE.md), [models implementation](../packages/platform-service/src/models/)                                                                                                    | Eligibility, pools, estimates, outcome ownership and narrow compatibility retries explained. No universal provider failover or guaranteed future billing.                             |
| Discussion/Knowledge             | [Workflow cookbook](WORKFLOW_COOKBOOK.md), [recovery report](examples/lantern-workshop/verification/profile-recovery.json)                                                                                    | User binding produces a checked canon document; changed content returns a fresh lexical citation after reconcile/rebuild. Live embeddings remain unverified.                          |
| Skills/roles/plugins/extensions  | [Contributor cookbook](EXTENSION_COOKBOOK.md), [integration guide](INTEGRATION_GUIDE.md)                                                                                                                      | Explicit roots, manifest/SDK, trust/access/isolation, contribution boundaries and bounded tool results explained. Windows isolated worker execution remains unavailable.              |
| MCP/connectors                   | [Contributor cookbook](EXTENSION_COOKBOOK.md), [MCP fixture](examples/lantern-mcp/server.cjs), [integration guide](INTEGRATION_GUIDE.md)                                                                      | Runnable stdio connection/tool example passed through the actual broker with revision 2025-11-25. Connectivity does not prove editor identity.                                        |
| Engine/DCC                       | [Native report](examples/lantern-workshop/native-acceptance.json), [fresh engine report](examples/lantern-workshop/verification/engine-acceptance.json), [extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md) | Named Godot headless, fresh Unity/Unreal and native Blender checks retain specific evidence. No production-game, graphical Lantern or every-version guarantee.                        |
| Assets                           | [Workflow gallery](WORKFLOW_SCREENSHOTS.md#synthetic-asset-review-and-import-recovery), [asset report](images/lantern-assets/capture-report.json)                                                             | Synthetic submission/download/review/path rejection/import passed; metadata-only GLB labeled clearly. Paid generation and artistic/native geometry acceptance remain open.            |
| Backups/credentials              | [Recovery runbook](RECOVERY_RUNBOOK.md), [backup screenshots](WORKFLOW_SCREENSHOTS.md#local-backup-restoration)                                                                                               | Project UI restore and service-level profile archive/restore/relaunch have separate reports. Wrong secret/key/occupied target distinguished; remote drill remains unverified.         |
| Updates/distribution             | [Release guide](RELEASE_GUIDE.md), [operations](OPERATIONS_GUIDE.md)                                                                                                                                          | Metadata/checksum/signature/install/rollback boundaries and existing release records explained. No new installer lifecycle or signing acceptance.                                     |
| Terms/research                   | [Glossary](GLOSSARY.md), [standards verification](research/documentation-standards-verification.md)                                                                                                           | Terms aligned with record ownership. Primary MCP/Agent Skills/Theia/Godot pages reopened; inaccessible sources remain labeled.                                                        |

## Findings corrected

- Staged Git review found an extra trailing blank line in generated release notes. Correct the renderer and verify a staged-release fixture with the new regression; all 12 tracking checks pass.
- Combined screenshot inspection found overview preview text retained in the agent request input. Clear it before submission and require the durable request to begin with the scripted fixture prompt; rerun all scenarios before publication.

- Link newer actual restore drills from the handbook instead of implying backup setup is the only evidence.
- Explain cost/latency estimate constraints, observed usage and agent token budgets separately from guarantees for unknown estimates.
- Explain fresh asset filenames on collision, preserving existing files, separately from outside-Project rejection.
- Specify Project skill/role roots and trust prerequisites rather than implicit authoring paths.
- Add bounded filesystem pages/continuation and truncated agent context already present in pending runtime repairs.
- Explain two specific HTTP 400 compatibility negotiations separately from universal retry/failover; successful streams are not replayed.
- Replace vague profile-path repair instructions with `project/open`, labeling unchanged-ID relocation source-reviewed rather than newly live-tested.

## Repeatable verification

Final browser rerun after the input correction passed all nine scenarios, 43 screenshots and zero renderer errors. The final tracking rerun passed 12 cases after the staged-whitespace regression was added. Other retained desktop/native reports keep their original dates and scope.

```powershell
npx turbo run build typecheck lint test --output-logs=errors-only
npm run test:changes
node scripts/check-release-version.cjs
node scripts/generate-system-reference.cjs --check
node scripts/generate-documentation-inventory.cjs --check
node scripts/check-documentation-evidence.cjs
node --test scripts/documentation/capture-tools.test.cjs
node scripts/verify-documentation-recovery.cjs
npm run format:check
npm run changelog:update
npm run changelog:check -- --base HEAD
```

Run links with `scripts/check-links.sh` in Bash (WSL on this Windows host). Explicitly check new docs/scripts with Prettier because repository formatting excludes those directories. CI now checks generated inventory and retained report integrity after builds.

The integrity checker compares contracts/settings/navigation with inventory and handbook. It checks seven capture reports, all 90 referenced PNG files, timestamps/checks/errors and all nine combined scenarios. These are file/record consistency assertions; visual-content review and each workflow's service assertions remain separate evidence.

The full repository gate passed all 33 tasks from valid Turbo cache. Tracking tests passed 11 fresh cases. A fresh isolated recovery rerun passed five checks, including diagnostic authentication, lexical rebuild, profile archive/restore/relaunch and exact credential preservation/wrong-key rejection. Earlier browser/Electron/native reports retain their dates; wording corrections do not claim new runs in every environment.

`npm ci` is skipped because concurrent work uses the shared installed dependency tree; no dependency is introduced. Final links/format/reference/record checks and publication are recorded in the [review work record](changes/2026-10-02-documentation-review.md). No open decision or work-package status is advanced.
