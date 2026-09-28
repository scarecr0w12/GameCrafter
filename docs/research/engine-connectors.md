# Engine Connectors: CLI and MCP Reference

**Last researched:** 2026-09-27

## Purpose

Summarize official automation entry points, notable open-source MCP bridges, and the distinction between project-file work and live-editor operations for Unity, Unreal Engine, and Godot. The design context requires CLI and MCP engine connectors and per-operation capability reporting ([platform design](../PLATFORM_DESIGN.md#confirmed-requirements-and-decisions)).

## Unity

### Official CLI and batch surfaces

- Launch the Editor with `-batchmode`, `-quit`, `-projectPath`, and `-executeMethod Namespace.Class.StaticMethod`; the target method must be static and in an `Editor` folder. Unity documents this for CI tasks including tests, builds, and preparing data ([Editor command-line reference](https://docs.unity3d.com/Manual/EditorCommandLineArguments.html)).
- Unity CLI offers project management and headless `build`, `run`, and `test` commands; its reference also lists `unity command`, `unity list`, `unity status`, `unity pipeline`, and `unity mcp` for connected Editors ([Unity CLI reference](https://docs.unity.com/en-us/unity-cli/unity-cli-reference)).
- Unity Pipeline connects the CLI to a running Editor; registered static `[CliCommand]` methods can be invoked through its local API, and commands can declare main-thread requirements ([Pipeline command authoring](https://docs.unity3d.com/Packages/com.unity.pipeline%400.3/manual/creating-commands.html)).
- Unity's current CLI MCP mode is first-party and supported; Unity documents the Editor-Pipeline-backed server as the replacement for the MCP server previously shipped in the in-Editor AI Assistant package ([Unity CLI replacement notice](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)).
- The AI Assistant package's MCP server is explicitly deprecated by Unity; third-party MCP packages and `unity mcp` are not affected by that deprecation ([deprecation scope](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)).

### Open-source MCP servers

| Project | Language and connection | Example tool surface | License / activity |
| --- | --- | --- | --- |
| [IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP) | C# Editor/Runtime plugin with a separate MCP server; client transport supports stdio or Streamable HTTP, and the Editor side communicates with the server through SignalR ([project FAQ](https://github.com/IvanMurzak/Unity-MCP/wiki/FAQ), [development docs](https://github.com/ivanmurzak/Unity-MCP/wiki/Contributing)). | Project says it can create GameObjects, manage assets, write scripts, capture screenshots, and run tests ([project README](https://github.com/IvanMurzak/Unity-MCP)). | Apache-2.0 ([repository](https://github.com/IvanMurzak/Unity-MCP)); latest activity date not established in this pass (unverified). |
| [Ozymandros/Unity-MCP-Server](https://github.com/Ozymandros/Unity-MCP-Server) | C#/.NET server for Unity Editor automation without Unity/UPM dependencies at build or runtime ([repository](https://github.com/Ozymandros/Unity-MCP-Server)). | Repository describes project, scene, script, prefab, and asset management ([repository](https://github.com/Ozymandros/Unity-MCP-Server)). | MIT; GitHub showed release v3.2.1 published 2026-03-22 ([release](https://github.com/Ozymandros/Unity-MCP-Server/releases/tag/v3.2.1)). |

### Live Editor versus CLI/file-only

- Batch-mode commands start the Editor process but run without interactive human input; they are suitable for scripted project work, testing, and builds ([Unity CLI manual](https://docs.unity3d.com/Manual/command-line-run-unity.html)).
- The documented connected-Editor commands and Pipeline execution target a live Editor session ([Unity CLI reference](https://docs.unity.com/en-us/unity-cli/unity-cli-reference), [Pipeline command authoring](https://docs.unity3d.com/Packages/com.unity.pipeline%400.3/manual/creating-commands.html)).
- Direct file edits can be made without the Editor, but this does not establish that Unity has imported, compiled, or validated those edits; validation requires a Unity invocation. (Implication from the CLI import/build/test surfaces above.)

## Unreal Engine

### Official CLI and batch surfaces

- Epic documents launching an Editor project from the command line by passing a `.uproject` path; the Editor executable can also start a game with `-game` ([Running Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/running-unreal-engine)).
- Epic documents `UnrealEditor-cmd.exe <project> -run=cook ...` for commandlet-driven cooking; `-run=<commandlet>` selects the engine-internal task. Executable names and flags vary by engine release and installation, so verify against the installed version ([UE 5.8 Build Operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine), [commandlet API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Commandlets/UCommandlet)).
- Unreal Automation Tool (`RunUAT.bat` / `RunUAT.sh`) provides command-line automation. Epic documents `BuildCookRun` for build/cook/package/deploy/run workflows ([UE 5.8 Build Operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine)).
- Epic's Unreal Engine 5.8 documentation describes the first-party Unreal MCP plugin running in the Editor; verify experimental status and availability against the targeted UE release before relying on it ([Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)).

### Open-source MCP servers

| Project | Language and connection | Example tool surface | License / activity |
| --- | --- | --- | --- |
| [runreal/unreal-mcp](https://github.com/runreal/unreal-mcp) | TypeScript/JavaScript MCP process uses Unreal Python Remote Execution; requires the Python Editor Script Plugin and Remote Execution enabled in a running project ([README](https://github.com/runreal/unreal-mcp)). | Python execution, asset listing/export/info/references, console commands, project/map information, world outliner, and validation ([README](https://github.com/runreal/unreal-mcp)). | MIT; npm package page showed a 2025-06-04 publish date, while repository last-push date was not confirmed here ([npm](https://www.npmjs.com/package/@runreal/unreal-mcp)). |
| [ChiR24/Unreal_mcp](https://github.com/ChiR24/Unreal_mcp) | TypeScript server plus native C++ Editor Automation Bridge; bridge uses a local WebSocket connection, with optional in-plugin HTTP/SSE transport ([README](https://github.com/ChiR24/Unreal_mcp), [bridge architecture](https://github.com/ChiR24/Unreal_mcp/blob/main/docs/editor-plugin-extension.md)). | Asset, actor, Blueprint, material, animation, level, and project actions; specific tools depend on installed Unreal plugins ([README](https://github.com/ChiR24/Unreal_mcp)). | MIT; exact latest activity date not verified in this pass ([repository](https://github.com/ChiR24/Unreal_mcp)). |
| [Epic Unreal MCP plugin](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor) | First-party, Editor-embedded MCP surface documented for UE 5.8; requires a live Editor session ([Epic documentation](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)). | Epic documentation should be treated as authoritative for the selected UE version's toolsets and setup. Tool inventory beyond documentation summary: unverified. | First-party; repository license/activity do not apply. Version and experimental availability should be checked per install ([Epic documentation](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)). |

### Live Editor versus CLI/file-only

- UAT and commandlets are process-invoked and can perform supported build, cook, package, and data tasks without an interactive Editor UI ([UE 5.8 Build Operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine)).
- The Python Remote Execution MCP route explicitly requires the Editor's Python plugin and remote execution enabled ([runreal/unreal-mcp setup](https://github.com/runreal/unreal-mcp)).
- The C++ Automation Bridge and first-party Editor-embedded MCP expose operations through the running Editor; they are not file-only interfaces ([ChiR24 bridge architecture](https://github.com/ChiR24/Unreal_mcp/blob/main/docs/editor-plugin-extension.md), [Epic Unreal MCP](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)).
- Project/source file access is distinct from a loaded Editor/asset state; available non-Editor coverage for each Unreal package format is unverified. Use documented UAT/commandlet tasks for batch validation rather than claiming a live Editor observation ([UE 5.8 Build Operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine), [Epic commandlet API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Commandlets/UCommandlet)).

## Godot

### Official CLI and headless surfaces

- `--headless` runs without a display; `--script`/`-s` runs a project or filesystem script, and `--check-only` parses scripts and exits ([Godot command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)).
- `--import` opens the Editor, waits for import completion, then quits; `--export-release` / `--export-debug` exports using a named preset and requires the Editor binary and installed templates ([Godot command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)).

### Open-source MCP servers

| Project | Language and connection | Example tool surface | License / activity |
| --- | --- | --- | --- |
| [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) | JavaScript/TypeScript Node MCP server launches Godot processes and works with project files; no editor addon is required for its listed process/file/project tools ([README](https://github.com/Coding-Solo/godot-mcp/blob/main/README.md), [source](https://github.com/coding-solo/godot-mcp/blob/main/src/index.ts)). | Launch Editor, run/stop projects, capture debug output, list/analyze projects, create scenes/add nodes, save scenes, and manage UIDs ([README](https://github.com/Coding-Solo/godot-mcp/blob/main/README.md)). | MIT; repository search showed last push 2026-03-18 ([repository](https://github.com/Coding-Solo/godot-mcp)). |
| [IvanMurzak/Godot-MCP](https://github.com/IvanMurzak/Godot-MCP) | C# Editor addon and shared MCP server; exposes Editor operations through the addon and server bridge ([repository](https://github.com/IvanMurzak/Godot-MCP)). | Repository describes node/scene/resource/script editing, screenshots, and project inspection ([repository](https://github.com/IvanMurzak/Godot-MCP)). | Apache-2.0; last activity not verified in this pass ([repository](https://github.com/IvanMurzak/Godot-MCP)). |

### Live Editor versus CLI/file-only

- Headless script checking, project script execution, import, and export are documented without an interactive UI ([Godot command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)).
- Coding-Solo's server can launch/run the project and manipulate some project/scene files, but a running game/editor is needed for execution feedback and captured runtime debug output ([project README](https://github.com/Coding-Solo/godot-mcp/blob/main/README.md)).
- Editor-addon MCP actions require the Godot Editor and addon enabled; a file-only connector must not report live scene-tree, viewport, or runtime state as observed ([IvanMurzak/Godot-MCP](https://github.com/IvanMurzak/Godot-MCP)).

## Implications for our connector contract

- Advertise capabilities per operation, not just per engine: distinguish `project-file`, `headless-process`, and `live-editor` execution modes, then include process/editor identity, version, readiness, and validation evidence.
- Model supported operations as discovered/versioned capabilities; each engine exposes different commandlets, pipeline commands, plugins, and live-session actions (sources above).
- Treat engine MCP as an optional bridge rather than the only integration route: all three engines document useful CLI/headless work, while many high-level editing and inspection tools require a live Editor.
- Keep arbitrary-code execution explicit in capability metadata; the Blender and Unreal MCP examples document code execution paths ([Blender MCP](https://github.com/ahujasid/blender-mcp), [runreal Unreal MCP](https://github.com/runreal/unreal-mcp)).

## Sources

- [Unity Editor command-line arguments](https://docs.unity3d.com/Manual/EditorCommandLineArguments.html)
- [Unity CLI reference](https://docs.unity.com/en-us/unity-cli/unity-cli-reference)
- [Unity CLI MCP replacement/deprecation](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)
- [Unity Pipeline command authoring](https://docs.unity3d.com/Packages/com.unity.pipeline%400.3/manual/creating-commands.html)
- [Unreal Engine: Running Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/running-unreal-engine)
- [Unreal commandlet API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Commandlets/UCommandlet)
- [Unreal Engine 5.8 Build Operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine)
- [Unreal MCP in Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)
- [Godot command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)
- [Unity-MCP](https://github.com/IvanMurzak/Unity-MCP)
- [Unreal-MCP](https://github.com/runreal/unreal-mcp)
- [Unreal MCP bridge docs](https://github.com/ChiR24/Unreal_mcp/blob/main/docs/editor-plugin-extension.md)
- [Godot MCP](https://github.com/Coding-Solo/godot-mcp)
- [Godot-MCP C# addon](https://github.com/IvanMurzak/Godot-MCP)
- [Unity MCP server .NET](https://github.com/Ozymandros/Unity-MCP-Server)
