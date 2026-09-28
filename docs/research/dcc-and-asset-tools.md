# DCC and Asset Generation Tools

**Last researched:** 2026-09-27

## Purpose

Record documented automation surfaces, MCP bridge examples, and API behavior for the DCC and 3D-generation tools named in the platform design ([platform design](../PLATFORM_DESIGN.md#agents-tools-and-access)). Product capabilities and licensing vary by version, subscription, and deployment; check the linked source before enabling a workflow.

## Authoring applications

### Blender

- `blender --background --python <script.py>` runs scripts without a GUI; `-P`/`--python` executes a file, and the Blender Python API (`bpy`) operates on loaded Blender data ([command-line arguments](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html), [Python API](https://docs.blender.org/api/current/)).
- Background work is suitable for rendering and scripted data operations; viewport/UI interactions are not implied by background mode ([background rendering](https://docs.blender.org/manual/en/latest/advanced/command_line/render.html)).
- [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) is a Python MCP server plus a Blender Python addon. The client/server connects over a local TCP socket to an addon inside Blender; documented tools include scene inspection, object/material operations, and Python-code execution ([README](https://github.com/ahujasid/blender-mcp), [server implementation](https://github.com/ahujasid/blender-mcp/blob/main/src/blender_mcp/server.py)). The README states MIT licensing; latest activity date not verified in this pass ([repository](https://github.com/ahujasid/blender-mcp)).
- [dcc-mcp-blender](https://github.com/dcc-mcp/dcc-mcp-blender) is a Python addon project described as embedding a Streamable HTTP MCP server in Blender; repository search reports MIT and last push 2026-07-19 ([repository](https://github.com/dcc-mcp/dcc-mcp-blender)). Specific current tool inventory: unverified.

### Autodesk Maya

- Maya ships `mayapy`, an Autodesk Python interpreter useful for batch processing and access to Maya libraries ([mayapy documentation](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Scripting/files/GUID-D64ACA64-2566-42B3-BE0F-BCE843A1702F.htm)).
- Maya's `-batch` startup mode executes commands without user input and exits; on Windows Autodesk directs users to `mayabatch.exe` ([Maya command-line startup](https://help.autodesk.com/cloudhelp/2022/ENU/Maya-GettingStarted/files/GUID-2E5D1D43-DC3D-4CB2-9A35-757598220F22.htm)).
- `commandPort` opens a socket for remote Maya commands, including `system(...)`; Autodesk warns that INET sockets have no user authentication/authorization and commands run with Maya user's permissions ([commandPort reference](https://help.autodesk.com/cloudhelp/2022/ENU/Maya-Tech-Docs/Commands/commandPort.html)). Keep it loopback-only and disabled unless a live-session bridge needs it.
- [GimbalGoats/GG_MayaMCP](https://github.com/GimbalGoats/GG_MayaMCP) is a local Python MCP server connecting to Maya's `commandPort`; it lists 71 typed tools covering scene, nodes, modeling, shading, skinning, animation, and viewport capture. MIT-licensed; its release page showed v0.6.1 published 2026-07-20 ([README](https://github.com/GimbalGoats/GG_MayaMCP), [release](https://github.com/GimbalGoats/GG_MayaMCP/releases/tag/v0.6.1)).
- [dcc-mcp-maya](https://github.com/dcc-mcp/dcc-mcp-maya) is a Maya plugin with a Rust sidecar/gateway and dispatcher into Maya; the project describes 72+ typed tools and Streamable HTTP ([repository](https://github.com/dcc-mcp/dcc-mcp-maya)). License and latest activity date were not verified in this pass.

### Autodesk 3ds Max

- Autodesk's standalone `3dsmaxbatch.exe <script_file>` accepts MAXScript and Python script files, optionally loads a scene, runs the script, then exits ([3ds Max Batch](https://help.autodesk.com/cloudhelp/2026/ENU/3DSMax-Batch/files/GUID-48A78515-C24B-4E46-AC5F-884FBCF40D59.htm)).
- Interactive 3ds Max also supports startup scripts through `-U MAXScript` / `-U PythonHost`; Autodesk describes silent mode for unattended scripts ([command-line scripting](https://help.autodesk.com/cloudhelp/2025/ENU/3DSMax-Basics/files/GUID-BCB04DEC-7967-4091-B980-638CFDFE47EC.htm)).
- [cl0nazepamm/3dsmax-mcp](https://github.com/cl0nazepamm/3dsmax-mcp) is a Python MCP server with a native bridge and MAXScript/Python support; repository description lists scene, material, modifier, controller, viewport, and procedural-graph tools, with a 2023–2027 Max version range ([README](https://github.com/cl0nazepamm/3dsmax-mcp)). MIT license; repository search showed a 2026-06-01 1.0.5 changelog entry ([changelog](https://github.com/cl0nazepamm/3dsmax-mcp/blob/master/CHANGELOG.md)).

### Cinema 4D

- Maxon's `c4dpy` is a bundled standalone Python interpreter and headless Cinema 4D instance; it can load/save scenes, construct scenes, render, and run plugins, but cannot do GUI-dependent work such as viewport access or dialogs ([c4dpy manual](https://developers.maxon.net/docs/py/2026_3_0/manuals/manual_py_c4dpy.html)). The manual documents Windows and macOS availability, not Linux; `c4dpy` on Linux is unverified.
- Maxon documents a Linux `Commandline`/`c4d_clr` executable for terminal rendering and says the Linux Cinema 4D build is command-line-render only ([Linux SDK setup](https://developers.maxon.net/docs/cpp/26_107/page_maxonapi_dev_linux.html)).
- Maxon also documents the Cinema 4D Python SDK and plugin command-line argument handling; API compatibility is version-sensitive ([Cinema 4D Python SDK](https://developers.maxon.net/docs/py/2026_3_0/), [command-line plugin message](https://developers.maxon.net/docs/cpp/2026_1_0/page_manual_module_functions.html)).
- [kumoproductions/mcp-cinema4d](https://github.com/kumoproductions/mcp-cinema4d) pairs a TypeScript stdio MCP server with a Python bridge plugin inside a running Cinema 4D session over local TCP; the README lists 68 tools for scene/entity, material, rigging, and animation work. The project is MIT-licensed and specifies Cinema 4D 2026+ ([README](https://github.com/kumoproductions/mcp-cinema4d)). Latest activity date not verified.

### ZBrush

- Maxon's ZBrush scripting surface includes ZScript; the current ZBrush Python SDK documents loading Python through the ZScript palette and passing a script using `ZBrush.exe -script <path>`. `-batch` requests process exit/error behavior for batch-script execution ([ZBrush Python quickstart](https://developers.maxon.net/docs/zbrush/py/2026_1_0/manuals/quickstart.html), [ZScript command reference](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/command-reference/command-reference.html)).
- The cited Python SDK documents startup script execution using `-script` and `-batch`, not a persistent background daemon; a general-purpose headless daemon capability is unverified ([ZBrush Python quickstart](https://developers.maxon.net/docs/zbrush/py/2026_1_0/manuals/quickstart.html)).
- [dcc-mcp-zbrush](https://github.com/dcc-mcp/dcc-mcp-zbrush) is a Python adapter for ZBrush's embedded Python SDK with an optional socket sidecar; repository labels the project pre-alpha and MIT licensed ([repository](https://github.com/dcc-mcp/dcc-mcp-zbrush)). The repo's release page showed v0.2.24 published 2026-07-30 ([release](https://github.com/dcc-mcp/dcc-mcp-zbrush/releases/tag/v0.2.24)).

## Generation APIs

### Meshy

- Authentication uses a Meshy account API key sent as `Authorization: Bearer <key>`; Meshy documents per-key monthly credit limits ([authentication](https://docs.meshy.ai/en/api/authentication)).
- Text-to-3D uses an asynchronous preview task followed by a refine task for texturing; task creation returns an ID, and clients retrieve/poll the matching task endpoint to terminal status before downloading signed result URLs ([Text-to-3D API](https://docs.meshy.ai/en/api/text-to-3d), [quickstart](https://docs.meshy.ai/en/api/quick-start)).
- Documented target formats include GLB, OBJ, FBX, STL, USDZ, and 3MF; 3MF must be explicitly requested ([Text-to-3D formats](https://docs.meshy.ai/en/api/text-to-3d)).
- API use is prepaid/credit-based, with endpoint/model-specific credit cost published in the pricing table ([API pricing](https://docs.meshy.ai/en/api/pricing)). Limits are per account and include requests/second and concurrent queued tasks; current tier values and 429 behavior are published on the rate-limit page and can change ([rate limits](https://docs.meshy.ai/en/api/rate-limits)).
- Meshy's help page says rights depend on the generation plan: paid-plan outputs are described as privately owned if not made public, while free-plan models use CC BY 4.0 with attribution; uploaded references must themselves be authorized ([commercial use FAQ](https://help.meshy.ai/en/articles/16102098-can-i-use-meshy-assets-commercially)). Treat these terms as subject to current contract and source-image rights.
- The public task/output examples expose IDs, status, progress, model URLs, thumbnails, and errors; a machine-readable license/provenance field was not verified in the cited API schema (unverified). Persist plan/tier, task ID, prompts/references, and terms snapshot in platform-side provenance metadata.

### Tripo3D

- API requests use an API key in `Authorization: Bearer <key>`; the v3 base URL is `https://openapi.tripo3d.ai/v3` ([API overview](https://developers.tripo3d.ai/en/docs)).
- Generation is asynchronous: POST to a generation endpoint, retain `task_id`, poll `GET /v3/tasks/{task_id}` or configure a webhook, and download the output on success. The task lifecycle documents queued/running/success/failed/cancelled and expired states ([task lifecycle](https://developers.tripo3d.ai/en/docs/task-lifecycle)).
- The text-generation result example includes `output.model_url`; the separate conversion endpoint documents GLTF, USDZ, FBX, OBJ, STL, and 3MF support ([text-to-model](https://developers.tripo3d.ai/en/docs/generation-text-to-model), [conversion](https://developers.tripo3d.ai/en/docs/models-convert)). Download links can be temporary and should be fetched promptly ([SDK download guidance](https://developers.tripo3d.ai/en/docs/sdk)).
- Tripo API pricing is credit-based; the pricing page and task response's consumed-credit value are the current sources of actual cost ([API pricing](https://docs.tripo3d.ai/get-started/pricing.html), [task lifecycle](https://developers.tripo3d.ai/en/docs/task-lifecycle)). Generation concurrency quotas are task/model-tier-specific and upload rate limits are documented separately; respect `Retry-After` and use backoff on 429 ([rate limits](https://docs.tripo3d.ai/get-started/rate-limits.html), [error handling](https://docs.tripo3d.ai/get-started/errors-and-error-handling.html)).
- Tripo's terms state outputs may be used for lawful commercial or noncommercial purposes subject to its restrictions; its help text says paid users generally retain generated-content rights, and making a model public grants the company usage/display rights ([terms](https://developers.tripo3d.ai/en/terms), [commercial-use FAQ](https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially)). Terms and source-material rights apply.
- The cited task schemas show task IDs and output URLs but do not document a standard per-output machine-readable license/provenance field; completeness of this observation is unverified. Preserve task, prompt/reference, account tier, and applicable terms metadata locally.

## Support matrix

| Tool | OS from cited vendor docs | Automation surface | MCP available? | Verified source |
| --- | --- | --- | --- | --- |
| Blender | Windows/Linux; vendor install matrix lists both | Background Python / `bpy`; live addon bridge for UI/session state | Yes: Python/TCP add-on, MIT | [Blender CLI](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html), [downloads](https://www.blender.org/download/), [blender-mcp](https://github.com/ahujasid/blender-mcp) |
| Maya | Windows/Linux (`mayapy` documented for both) | `mayapy`, `mayabatch`, live `commandPort` | Yes: Python MCP, local socket | [mayapy](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Scripting/files/GUID-D64ACA64-2566-42B3-BE0F-BCE843A1702F.htm), [Maya MCP](https://github.com/GimbalGoats/GG_MayaMCP) |
| 3ds Max | Windows (Autodesk product requirements) | `3dsmaxbatch.exe` with MAXScript/Python | Yes: Python/native bridge; live Max needed | [Batch](https://help.autodesk.com/cloudhelp/2026/ENU/3DSMax-Batch/files/GUID-48A78515-C24B-4E46-AC5F-884FBCF40D59.htm), [requirements](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-requirements-for-Autodesk-3ds-Max.html), [MCP](https://github.com/cl0nazepamm/3dsmax-mcp) |
| Cinema 4D | Windows `c4dpy`; Linux command-line render build documented; Linux `c4dpy` unverified | `c4dpy` headless Python; Linux `Commandline`/`c4d_clr`; live UI/session MCP bridge | Yes: TypeScript/Python TCP bridge | [c4dpy](https://developers.maxon.net/docs/py/2026_3_0/manuals/manual_py_c4dpy.html), [Linux SDK setup](https://developers.maxon.net/docs/cpp/26_107/page_maxonapi_dev_linux.html), [MCP](https://github.com/kumoproductions/mcp-cinema4d) |
| ZBrush | Windows CLI example documented; Linux support unverified | ZScript and startup Python script; batch flag | Yes: pre-alpha Python adapter | [ZBrush Python](https://developers.maxon.net/docs/zbrush/py/2026_1_0/manuals/quickstart.html), [MCP](https://github.com/dcc-mcp/dcc-mcp-zbrush) |
| Meshy | Any OS with HTTPS client (API) | REST async job API | N/A—provider API, not an MCP server in cited docs | [API docs](https://docs.meshy.ai/en/api) |
| Tripo3D | Any OS with HTTPS client (API) | REST async job API | N/A—provider API, not an MCP server in cited docs | [API docs](https://developers.tripo3d.ai/en/docs) |

## Sources

- [Blender command-line arguments](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html)
- [Blender Python API](https://docs.blender.org/api/current/)
- [Maya mayapy](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Scripting/files/GUID-D64ACA64-2566-42B3-BE0F-BCE843A1702F.htm)
- [Maya batch startup](https://help.autodesk.com/cloudhelp/2022/ENU/Maya-GettingStarted/files/GUID-2E5D1D43-DC3D-4CB2-9A35-757598220F22.htm)
- [Maya commandPort](https://help.autodesk.com/cloudhelp/2022/ENU/Maya-Tech-Docs/Commands/commandPort.html)
- [3ds Max Batch](https://help.autodesk.com/cloudhelp/2026/ENU/3DSMax-Batch/files/GUID-48A78515-C24B-4E46-AC5F-884FBCF40D59.htm)
- [3ds Max script startup](https://help.autodesk.com/cloudhelp/2025/ENU/3DSMax-Basics/files/GUID-BCB04DEC-7967-4091-B980-638CFDFE47EC.htm)
- [Cinema 4D c4dpy](https://developers.maxon.net/docs/py/2026_3_0/manuals/manual_py_c4dpy.html)
- [Cinema 4D Linux SDK setup](https://developers.maxon.net/docs/cpp/26_107/page_maxonapi_dev_linux.html)
- [ZBrush Python SDK](https://developers.maxon.net/docs/zbrush/py/2026_1_0/manuals/quickstart.html)
- [Meshy authentication](https://docs.meshy.ai/en/api/authentication)
- [Meshy text-to-3D](https://docs.meshy.ai/en/api/text-to-3d)
- [Meshy pricing](https://docs.meshy.ai/en/api/pricing)
- [Meshy rate limits](https://docs.meshy.ai/en/api/rate-limits)
- [Tripo API overview](https://developers.tripo3d.ai/en/docs)
- [Tripo task lifecycle](https://developers.tripo3d.ai/en/docs/task-lifecycle)
- [Tripo pricing](https://docs.tripo3d.ai/get-started/pricing.html)
- [Tripo rate limits](https://docs.tripo3d.ai/get-started/rate-limits.html)
