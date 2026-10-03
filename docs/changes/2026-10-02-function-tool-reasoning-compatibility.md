# Adapt explicit function-tool reasoning restrictions

**Release:** 0.4.0

**Impact:** patch

**Category:** Fixed

## Summary

Handle a second provider compatibility restriction exposed by a real gpt-6-sol function-tool request after the completion-token fix.

## Details

The corrected service's ordinary gpt-6-sol request returned OK, but a function-tool request failed with HTTP 400: the model requires Responses or `reasoning_effort: none` for function tools on Chat Completions. Extend the shared request negotiation to set reasoning_effort to none only when a structured HTTP 400 names that parameter, function tools and the explicit supported alternative. Remember the accepted option per account, endpoint and model, applying it only to tool-bearing requests. Token-field and reasoning-field negotiations each occur at most once, in either order; the maximum is three HTTP attempts. Unrelated errors and successful streams are not replayed. The original numeric output limit is preserved.

This uses the existing Chat Completions connector. For affected function-tool requests, provider reasoning effort is disabled; it does not implement Responses or promise provider reasoning-token support for those tool requests. No persisted model capability, routing, access policy or schema changes. A fresh version is used because the 0.3.0 testing package was already staged; its installer and evidence are retained.

## Validation

Live source-service ordinary request to gpt-6-sol returned OK (11 input tokens, 4 output tokens). The live tool request reproduced the provider's additional restriction. New regression tests reproduced that exact rejection in streamed and complete calls before the fix, then passed after the change, including reasoning rejection followed by token rejection and remembered accepted fields. All 12 provider tests passed. After the extension, a real gpt-6-sol request returned the requested probe/check tool call with value OK (160 input tokens, 30 output tokens); a follow-up carrying a tool result returned VERIFIED (218 input tokens, 5 output tokens). The probe was not dispatched to any tool implementation and changed no project files. A real deepseek-flash request still returned OK using the legacy-compatible path (34 input tokens, 12 output tokens).

Full Turbo run completed 32 of 33 tasks successfully. The platform-service suite had 362 passing tests and 11 skips, with one existing BoardService sequence test exceeding its five-second timeout while the Windows installer was also unpacking. No board source changed. Reran that entire test file and the provider suite after installation finished: all 16 tests passed. All build/typecheck/lint tasks passed; no timeout was suppressed or assertion weakened. Formatting, generated references, whitespace and repository links passed.

Packaged, staged and installed 0.4.0 after the user approved Windows UAC. Installed service/info reported 0.4.0 and retained four projects; the running daemon executable was the installed application. Its adapter hash matched the tested and staged build. The installed service returned a real gpt-6-sol probe/check call with value OK (160 input tokens, 30 output tokens), then returned VERIFIED after the actual returned call ID and tool result were carried into the follow-up (227 input tokens, 5 output tokens). No probe implementation was executed or project content changed. Reconnected the existing CFA bridge; refreshed Vealoria project-file, headless-process and live-editor readiness all reported ready. No complete new swarm authoring/delegation task was run.

## Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-02-function-tool-reasoning-compatibility.md`
