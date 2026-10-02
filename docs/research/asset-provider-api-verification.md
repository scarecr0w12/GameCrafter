# Tripo v3 adapter contract verification

**Last researched:** 2026-10-01

This is documentation verification, not a paid live-generation test. Live account authentication, image acceptance, conversion output, and credit charging remain **unverified**.

## Verified request contracts

- Local image references must be uploaded to `POST /v3/files` using a multipart `file` field. The response supplies `data.file_token`, usable as the next request's `input`. The upload reference lists PNG and JPEG images with a 20 MB limit. GameCrafter rejects other upload formats before submission. [File upload](https://developers.tripo3d.ai/en/docs/files).
- `POST /v3/generation/image-to-model` accepts a file token, public URL, or prior image task ID; its required `model` parameter includes `v3.1-20260211`. A base64 data URI is not a documented input type. The generation reference also lists WebP, whereas the upload reference lists PNG/JPEG; WebP upload support remains **unverified**. [Image-to-model](https://developers.tripo3d.ai/en/docs/generation-image-to-model).
- `POST /v3/models/convert` accepts a generation task ID as `input` and uppercase target formats including GLTF, FBX, USDZ, OBJ, STL, and 3MF. Its GLTF example returns a GLB URL. GameCrafter maps requested `glb` to this documented GLTF conversion selector. [Conversion](https://developers.tripo3d.ai/en/docs/models-convert).
- `GET /v3/tasks/{task_id}` reports progress, status, model/preview URLs, consumed credits, and optional `error_message` for failures. GameCrafter preserves and redacts that failure message. [Task query](https://developers.tripo3d.ai/en/docs/task-query).
- The balance endpoint is `GET /v3/account/balance`. The undocumented `/v3/user/balance` fallback has been removed. [Account](https://developers.tripo3d.ai/en/docs/account).

## Repository evidence

[Provider adapter](../../packages/platform-service/src/assets/providers/tripo3d.ts) and [HTTP fixture tests](../../packages/platform-service/src/assets/providers/providers.test.ts) cover multipart upload encoding/authentication, file-token generation input, model selection, conversion requests, task results, failure-message redaction, balance, and retry behavior. Fixtures validate request shape; they cannot establish production provider acceptance.

Text-generation `negative_prompt` support remains **unverified**. Paid-operation idempotency, provider-side upload cleanup, and live conversion checks remain separate work.
