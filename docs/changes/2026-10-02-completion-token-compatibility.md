# Adapt completion token limits for OpenAI-compatible models

**Release:** 0.3.0

**Impact:** patch

**Category:** Fixed

## Summary

Fix models rejecting `max_tokens` with an explicit request to use `max_completion_tokens`, in both streamed and complete responses.

## Details

The installed 0.2.0 Vealoria task `01a0feda-ed96-7039-a8a0-e82239d645a5` failed with HTTP 400, `unsupported_parameter`, `param: max_tokens`. This is separate from the earlier filesystem context overflow. The shared adapter always sent the legacy field. Preserve that field for compatible servers, but retry once using the same numeric limit as `max_completion_tokens` when an HTTP 400 structured error explicitly rejects `max_tokens` and names its replacement. Remember a successfully accepted replacement per account, endpoint and model for the provider instance lifetime. Do not retry unrelated failures, transport errors or streams after consumption. No stored schema, settings, credentials, model routing or access policy changes.

OpenAI's [official SDK documentation](https://github.com/openai/openai-python/blob/main/src/openai/resources/chat/completions/completions.py) documents the newer completion limit and the legacy field's incompatibility with reasoning models. The newer limit can include reasoning tokens; the fix retains the caller's limit rather than increasing spend automatically.

## Validation

Regression tests first reproduced the exact HTTP 400 for streaming and non-streaming calls. After the fix, both passed, including subsequent requests using the remembered parameter, unchanged messages/tools and nonduplicated stream deltas. Three additional tests confirm unrelated authentication/parameter/error-code failures receive no retry. All 10 provider tests and platform-service typecheck passed. Full Turbo verification passed all 33 tasks, including 361 passing platform-service tests and 11 skips. Formatting, generated references, diff whitespace, work-record coverage and documentation links passed. Packaged and staged 0.3.0; the adapter hash matched the tested source build. A live source-service request to the exact failed gpt-6-sol model returned OK (11 input tokens, 4 output tokens). A subsequent function-tool probe exposed a separate reasoning-effort restriction, addressed in the function-tool reasoning compatibility record and a later testing version. Ordinary completion success does not claim swarm function-tool acceptance for 0.3.0.

## Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-02-completion-token-compatibility.md`
