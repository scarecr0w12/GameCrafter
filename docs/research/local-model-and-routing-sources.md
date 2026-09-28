# Model Routing, Local Inference, and Qdrant Sources

**Last researched:** 2026-09-27

## Purpose

Summarize OpenRouter's public catalog/routing/accounting APIs, model discovery and embeddings for common OpenAI-compatible local servers, and Qdrant's collection, tenancy, and local deployment options. The design calls for separately running local model servers and a replaceable local vector-store adapter ([technical architecture](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design)).

## OpenRouter

### Model registry endpoint

- `GET https://openrouter.ai/api/v1/models` returns a standardized model catalog; the model object includes `id`, canonical slug, display name, description, `context_length`, `architecture`, `pricing`, `top_provider`, per-request limits, supported/default parameters, and optional expiration metadata ([models guide](https://openrouter.ai/docs/guides/overview/models), [get model](https://openrouter.ai/docs/api/api-reference/models/get-a-model-by-its-slug)).
- `architecture` identifies input/output modalities and tokenizer/instruction format; use it with `supported_parameters` to filter for text/image/audio, tools, JSON, and other required capabilities ([models guide](https://openrouter.ai/docs/guides/overview/models)).
- Catalog prices are quoted per token/request/unit in USD; common fields include prompt and completion cost, and model variants may include image, audio, caching, or tool pricing. Treat catalog prices as metadata, not final billing ([models guide](https://openrouter.ai/docs/guides/overview/models), [pricing schema](https://openrouter.ai/docs/client-sdks/typescript/models/publicpricing)).
- `context_length` is the listed model context window; provider-specific endpoints can advertise endpoint context length, prompt/completion limits, pricing, and supported parameter differences ([model endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model)).
- The list endpoint supports filters and sorting, including supported parameter, minimum context, provider, and price/context/latency/throughput sorts; it supports pagination ([models guide](https://openrouter.ai/docs/guides/overview/models)).
- Models and prices change; refresh the model registry and store a fetch timestamp/source rather than treating catalog metadata as immutable ([models guide](https://openrouter.ai/docs/guides/overview/models)).

### Provider routing

- Requests may choose `provider.order`, restrict providers with `only`, skip providers with `ignore`, and control fallback with `allow_fallbacks`; `require_parameters` filters providers to ones supporting all supplied parameters ([provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)).
- `data_collection` can allow or deny providers that retain data; `zdr` limits eligible endpoints to Zero Data Retention providers. These preferences can make a request unsatisfiable if no endpoint qualifies ([provider selection](https://openrouter.ai/docs/guides/routing/provider-selection), [ProviderPreferences schema](https://openrouter.ai/docs/client-sdks/typescript/models/providerpreferences)).
- Routing supports provider ordering or sorting (for example by price, throughput, or latency), quantization preferences, and a `max_price` constraint ([provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)).
- Default routing load-balances among providers; explicit `order` or `sort` disables load balancing, according to the provider-selection guide ([provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)).

### Usage and cost accounting

- Non-streaming completions include a `usage` object; streamed chat responses carry final usage in a terminal SSE chunk before `[DONE]` ([usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [streaming reference](https://openrouter.ai/docs/api_reference/streaming)).
- Usage metadata can include prompt/completion/total tokens, reasoning and cached-token detail, charged cost, and upstream inference cost ([usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)).
- Each generation has an ID; `GET /api/v1/generation?id=...` retrieves metadata such as model, provider, router, token counts, latency, total cost, upstream cost, and provider-response records ([generation metadata API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)).
- Persist the response's actual usage/cost and generation ID for accounting; do not estimate final bill solely from catalog rates when provider, caching, modality, or tool costs may differ ([usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [model pricing schema](https://openrouter.ai/docs/client-sdks/typescript/models/publicpricing)).

## OpenAI-compatible local inference servers

### Ollama

- Ollama serves an OpenAI-compatible API in addition to its native API; its compatibility guide documents `/v1/models` and `/v1/embeddings` support ([Ollama OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx)).
- The native `POST /api/embed` endpoint accepts one or multiple text inputs and returns embedding vectors; the endpoint can truncate or reject inputs beyond the model context depending on request configuration ([Ollama embed API](https://docs.ollama.com/api/embed)).
- OpenAI-compatible embeddings require a suitable embedding model; native `/api/embed` is Ollama-specific and should be treated as a provider adapter path rather than assumed identical to `/v1/embeddings` ([Ollama compatibility guide](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx), [embedding capability](https://docs.ollama.com/capabilities/embeddings)).

### LM Studio

- LM Studio's OpenAI-compatible server exposes `GET /v1/models`, chat/completion APIs, and `POST /v1/embeddings` ([compatibility endpoints](https://lmstudio.ai/docs/developer/openai-compat), [models](https://lmstudio.ai/docs/developer/openai-compat/models), [embeddings](https://lmstudio.ai/docs/developer/openai-compat/embeddings)).
- Its model-list endpoint returns models visible to the server; with Just-In-Time loading enabled, the list may include downloaded models that are not currently loaded ([LM Studio model list](https://lmstudio.ai/docs/developer/openai-compat/models)).

### llama.cpp server

- `llama-server` provides OpenAI-compatible chat completion and embeddings routes; the embeddings endpoint is enabled with the server's embedding option and requires a compatible model ([llama.cpp server README](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)).
- The server's API compatibility is intentionally practical rather than a guarantee of full OpenAI API parity; test required request parameters and tool behavior against the chosen model/build ([llama.cpp server README](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)).
- `/v1/models` is used by common clients for model discovery, but exact returned model IDs and behavior depend on launch configuration/build; a stable normalized metadata contract beyond the served model ID is unverified ([server README](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)).

### vLLM

- vLLM offers an OpenAI-compatible HTTP server and supports `/v1/models`; the response can list the served base model and configured adapters ([vLLM OpenAI server](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/), [model-serving API](https://docs.vllm.ai/en/stable/api/vllm/entrypoints/openai/models/serving/)).
- vLLM documents `/v1/embeddings` for embedding models and supports the OpenAI embeddings client schema for models configured for embedding tasks ([vLLM OpenAI server](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/), [embedding model guide](https://docs.vllm.ai/en/latest/models/pooling_models/embed/)).
- Its documentation warns that the `--api-key` option protects specified `/v1`, `/v2`, and `/inference` routes but not every endpoint on the same server; do not expose the server based on that API key alone ([vLLM authentication warning](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/)).

### Adapter contract implications

- Probe `/v1/models` at the configured endpoint and retain the raw response; OpenAI-compatible lists differ, and a server may report loaded, downloaded, or only configured models ([LM Studio models](https://lmstudio.ai/docs/developer/openai-compat/models), [vLLM models](https://docs.vllm.ai/en/stable/api/vllm/entrypoints/openai/models/serving/), [Ollama compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx)).
- Treat embeddings as a capability probe, not an assumption from chat support; Ollama native `/api/embed` differs from OpenAI-compatible routes, and vLLM requires an embedding model/task ([Ollama embeddings](https://docs.ollama.com/api/embed), [vLLM embeddings](https://docs.vllm.ai/en/latest/models/pooling_models/embed/)).
- Endpoint-specific context, loaded model identity, embedding dimensions, supported features, and authentication should be discovered or configured and recorded with freshness; avoid silently translating unsupported parameters ([OpenRouter model fields](https://openrouter.ai/docs/guides/overview/models), [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)).

## Qdrant

### Data model and tenancy

- A collection is a named set of points, where points contain vectors and optional payload; single-vector collections share configured dimensions and metric ([collections](https://qdrant.tech/documentation/manage-data/collections/)).
- Named vectors store several vectors per point; each named vector can have distinct dimensions and distance metric ([named vectors](https://qdrant.tech/documentation/manage-data/vectors/)).
- Qdrant recommends payload-based partitioning in one collection for many small similarly sized tenants; a payload field (for example `project_id`) labels each point and every query must filter by that field ([multitenancy guide](https://qdrant.tech/documentation/manage-data/multitenancy/)).
- Create a keyword payload index for the tenant field; `is_tenant=true` is an optional hint available from Qdrant 1.11.0 that can co-locate tenant vectors for efficient reads ([multitenancy guide](https://qdrant.tech/documentation/manage-data/multitenancy/)).
- For a small number of larger tenants needing stronger isolation, Qdrant documents user-defined sharding as an alternative with greater per-tenant resource overhead ([multitenancy guide](https://qdrant.tech/documentation/manage-data/multitenancy/)).
- Tenant filtering is an application policy as well as an index concern: enforce mandatory project filters on writes and all query/delete paths, and test that no adapter call can omit the filter (implementation recommendation based on Qdrant's payload-partitioning design; [multitenancy guide](https://qdrant.tech/documentation/manage-data/multitenancy/)).

### Local deployment choices

- Qdrant Server can run as a Docker container or as a standalone binary; official installation docs list self-hosted deployment and platform-specific release assets, including Windows and Linux builds ([installation guide](https://qdrant.tech/documentation/installation/), [official releases](https://github.com/qdrant/qdrant/releases)).
- The server exposes REST and gRPC; default local quickstart ports are REST `6333` and gRPC `6334`. Review security settings before binding beyond loopback ([Qdrant quickstart](https://qdrant.tech/documentation/quickstart/), [security](https://qdrant.tech/documentation/guides/security/)).
- The official `qdrant-client` Python library has local mode with `:memory:` or a persistent filesystem path and no server process; client documentation positions it for small-scale use, demos, and tests ([client README](https://github.com/qdrant/qdrant-client/blob/master/README.md), [local implementation](https://github.com/qdrant/qdrant-client/blob/master/qdrant_client/local/qdrant_local.py)).
- Qdrant Edge is a separate embedded vector engine with Python bindings and a Rust crate; it stores an Edge Shard on local disk and runs in-process without a background service ([Edge overview](https://qdrant.tech/documentation/edge/), [Edge quickstart](https://qdrant.tech/documentation/edge/edge-quickstart/)).
- Edge is not equivalent to the full client-server API: Python/Rust method coverage differs, and one Edge Shard directory can only be open in one process at a time ([Edge API](https://qdrant.tech/documentation/edge/edge-api/), [shard lifecycle](https://qdrant.tech/documentation/edge/edge-api/shard-lifecycle/)).
- `qdrant-client` local mode is currently Python-specific; a Node/TypeScript platform can use Qdrant Server's local binary endpoint or build a distinct adapter for Edge bindings rather than assuming Python local mode is available in-process ([qdrant-client README](https://github.com/qdrant/qdrant-client/blob/master/README.md), [Qdrant server](https://qdrant.tech/documentation/installation/), [Edge API](https://qdrant.tech/documentation/edge/edge-api/)).
- The Qdrant quickstart warns that default local server deployments may have no authentication; keep it bound to localhost or configure authentication/TLS before allowing network access ([Qdrant quickstart](https://qdrant.tech/documentation/quickstart/), [security guide](https://qdrant.tech/documentation/guides/security/)).

### Design implications

- Keep router eligibility deterministic: provider/model metadata is mutable; store a timestamp and snapshot for the metadata used during a selection ([OpenRouter models](https://openrouter.ai/docs/guides/overview/models)).
- Record both estimated and provider-reported cost, stream-final usage, generation IDs, provider, selected model, and routing constraints for reviewable accounting ([OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [generation metadata](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)).
- Provide generic OpenAI-compatible chat and embeddings paths plus provider-specific capability extensions; don't assume that identical `/v1` paths imply feature parity ([llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server), [vLLM](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/), [Ollama](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx)).
- Qdrant Server as a local standalone process best matches a TypeScript service and replaceable REST/gRPC adapter; use one collection plus mandatory project payload filtering for many small Projects, with user-defined shards/collections only where stronger isolation or workload separation justifies operational cost ([Qdrant install](https://qdrant.tech/documentation/installation/), [multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/)).
- Treat local Qdrant mode or Edge as a product variant with different API/runtime properties rather than silently substituting it for Server ([Qdrant local client](https://github.com/qdrant/qdrant-client/blob/master/README.md), [Edge API](https://qdrant.tech/documentation/edge/)).

## Sources

- [OpenRouter models guide](https://openrouter.ai/docs/guides/overview/models)
- [OpenRouter provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter model endpoint list](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model)
- [OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
- [OpenRouter generation metadata](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)
- [Ollama OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx)
- [Ollama embeddings](https://docs.ollama.com/api/embed)
- [LM Studio OpenAI-compatible API](https://lmstudio.ai/docs/developer/openai-compat)
- [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
- [vLLM OpenAI-compatible server](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/)
- [Qdrant collections](https://qdrant.tech/documentation/manage-data/collections/)
- [Qdrant multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/)
- [Qdrant Edge](https://qdrant.tech/documentation/edge/)
- [Qdrant installation](https://qdrant.tech/documentation/installation/)
- [Qdrant client local mode](https://github.com/qdrant/qdrant-client/blob/master/README.md)
