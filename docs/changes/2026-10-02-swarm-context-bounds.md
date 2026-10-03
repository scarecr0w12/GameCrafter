# Bound swarm file discovery and agent context

**Release:** 0.2.0

**Impact:** minor

**Category:** Fixed

## Summary

Prevent recursive file discovery and oversized tool responses from producing multi-million-character swarm model requests. Add bounded file-list pages, generated-tree filtering, checkpoint repair and a local request-size guard.

## Details

- Live Vealoria diagnosis found the failed model request contained a single recursive `fs/list` result of 4,164,840 characters covering 29,570 entries. The two activated skill bodies were 3,889 and 4,262 characters; all fifteen offered tool definitions totalled 7,391 characters. Skill autoactivation was limited to role skills, with additional skills activated on demand. All skills were not being loaded.
- Root cause: filesystem listing recursively enumerated the entire project, including generated engine files, caches and Git metadata. Transcript compaction excluded the six most recent messages and returned without action when all messages were recent. Thus a recent multi-megabyte tool result went directly into the next provider request.
- `fs/list` now returns up to 100 entries by default, supports `limit` (1-200), `offset` (0-100000), and `includeGenerated`, and bounds each page's serialized entries to approximately 12,000 characters. It returns explicit `truncated` and `nextOffset` metadata. Recursive descent skips .git, .gamecrafter, node_modules, Intermediate, Saved, DerivedDataCache and Binaries unless requested. Directory entries remain visible; explicit paths into those directories remain readable. Pages use deterministic sorted depth-first traversal; callers should keep the path/options fixed and expect live filesystem changes to affect offsets.
- Agent transcripts store at most 16,000 characters per tool result, with an explicit truncation marker, original size, bounded preview and guidance to request narrower data. Full tool outputs remain in the broker's durable call records. Previously saved oversized tool results are bounded when resuming checkpoints, without replaying tools.
- Before every model call, estimate the complete serialized messages and tool schemas at three characters per token, including assistant tool-call arguments. Reject oversized remaining context locally with an actionable error. The estimate is conservative for ordinary prose but is not an exact provider tokenizer or a model-specific context guarantee. Large pinned inputs are rejected rather than silently discarded. Update the setting description and generated settings references.
- Compatibility: input options and response metadata are additive; entries retain their existing shape. Consumers must follow nextOffset instead of assuming a recursive response is exhaustive. No persisted record schema, RPC method or package identifier was renamed. The new pagination behavior is recorded as minor impact.

## Validation

- Added the multi-megabyte runtime regression before the fix: second request was 4,502,376 characters and failed the 240,000-character bound. The paging regression initially failed because its new options were rejected by the old tool schema.
- Focused runtime and broker tests passed after the changes. Further runtime coverage checks legacy checkpoint recovery without replay and local rejection of oversized pinned inputs/tool schemas.
- Replayed the exact original `{path: '.', recursive: true}` operation using the compiled builtin tool against the actual Vealoria filesystem: 100 entries, 11,215 serialized characters, truncated true and nextOffset 100, with input/output schema validation.
- `npm ci --foreground-scripts` completed on native Windows. The initial full build/typecheck run caught a widened TypeScript entry type; it was corrected before rerunning. Final `npx turbo run build typecheck lint test` passed all 33 tasks, including 95 platform-service test files with 356 passing tests and 11 skips. The runtime suite passed all 8 tests. Both Theia application builds passed.
- All 11 change-tracking tests, full formatting, generated reference freshness, version agreement, diff whitespace and local changed-file coverage checks passed. Repository-wide documentation links passed in WSL Ubuntu.
- Packaged 0.2.0 successfully; the Windows verifier confirmed the native addon, matching service version and all 30 bundled skills. The packaged runtime SHA256 matched the tested source-build runtime. Replayed the actual failed Vealoria task checkpoint through the packaged runtime with an offline completion stub: the next request was 37,366 characters, with its former 4,164,840-character file result reduced to a 13,657-character explicit preview. No filesystem operation was replayed and no provider call or production task state was changed by this measurement.
- Installed and reopened PlayWeld 0.2.0. The installed service returned bounded Vealoria filesystem pages with continuation metadata and no duplicate entries between the first two pages. Its runtime hash matched the tested package. All engine readiness layers reported ready after reconnecting the existing CFA bridge. No new paid provider request was made; the original failed task was retained.

## Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/tools/builtin-tools.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/settings-schemas.json`
- `docs/changes/2026-10-02-swarm-context-bounds.md`
