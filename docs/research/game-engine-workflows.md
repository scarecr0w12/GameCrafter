# Game engine development and verification workflows

**Last researched:** 2026-10-01

## Purpose

Provide primary-source evidence for the engine coding, debugging, integration testing, and build procedures in bundled GameCrafter skills.
This informs the skill contracts in [Skills, Agent Roles, and Tool Connections](../SKILLS_AGENTS_AND_TOOLS.md#2-skills).
The recommendations here are engineering defaults, not new user-confirmed product requirements.

## Research scope and evidence

- The Unreal pages opened in this pass explicitly identify the 5.6 documentation edition. [Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- The Unity manual/API pages opened identify Unity 6.0, version 6000.0. [Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- The Unity testing commands below come from the Test Framework 1.4 documentation, a package version boundary distinct from the Editor version. [Test Framework command-line reference](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- The Godot pages opened identify the 4.4 documentation edition. [Command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)

These reference editions are reproducible baselines; they are not a claim about the latest engine releases.
No engine commands, gameplay tests, packaged builds, or live connector tests were executed for this research note.
Compatibility of a particular installed editor, connector, SDK, device, or project remains unverified until exercised.

## Unreal Engine 5.6

- Unreal Automation supports API/unit, feature, content stress, and screenshot comparison test categories. [Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- The framework depends on engine systems and is described as unsuitable for pure unit testing; Epic points to Low-Level Tests for that boundary. [Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- Functional Testing supports level testing with Blueprint, while Automation Driver supports simulated user input. [Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- Epic's test guidelines require independence from assumed editor/game state and cleanup of generated disk files. [Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- Automation can select named tests or groups through executable arguments and export JSON/related HTML reports with `-ReportExportPath`. [Run Automation Tests](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine?application_version=5.6)
- Unreal build operations separate build, cook, stage, package, deploy, and run; UAT's BuildCookRun orchestrates these operations. [Build operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine?application_version=5.6)
- Epic recommends generating build arguments using a Custom Launch Profile because manually assembling the arguments is more error-prone. [Build operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine?application_version=5.6)
- Target availability depends on the correct platform SDK/tooling; the document recommends checking what the chosen engine supports. [Build operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine?application_version=5.6)
- Cook-by-the-book prepares content before deployment and is recommended in the document for performance testing and playtests. [Build operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine?application_version=5.6)
- Blueprint Classes provide reusable behavior across levels; Level Blueprints are suited to level-specific behavior. [Blueprint best practices](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine?application_version=5.6)
- Epic describes event-driven functionality as suited to Blueprints and complex expensive per-tick work as a candidate for native C++. [Blueprint best practices](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine?application_version=5.6)
- Unreal Insights captures and analyzes traces; sessions use `.utrace` files and accompanying generated data can use `.ucache`. [Unreal Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine?application_version=5.6)

## Unity 6.0 and Test Framework 1.4

- Unity's `-batchmode` supports noninteractive command-line execution, and the console receives less information than the full log files. [Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- Batch mode cannot open the same project while another Unity Editor has that project open. [Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- `-executeMethod` invokes a static method in an Editor script; exceptions or explicit nonzero EditorApplication.Exit calls can report failure. [Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- Explicit `-projectPath` and `-logFile` arguments select the project and retained editor log. [Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- BuildPipeline.BuildPlayer returns a BuildReport; the API examples inspect its summary result. [BuildPlayer API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/BuildPipeline.BuildPlayer.html)
- Test Framework 1.4 supports `-runTests`, test filtering, test platform selection, and `-testResults` output. [Test Framework command-line reference](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- Test result files use NUnit XML, and the documentation warns that components under test have no common exit-code definition. [Test Framework command-line reference](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- Synchronous test execution is limited to EditMode and filters out tests requiring multiple frames, including UnityTest-style tests. [Test Framework command-line reference](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- Unity .meta files hold asset identifiers and import settings; moves outside Unity must move the matching .meta file to preserve references. [Asset metadata](https://docs.unity3d.com/6000.0/Documentation/Manual/AssetMetadata.html)
- Losing a script's .meta identity can leave GameObjects or Prefabs with unassigned script components. [Asset metadata](https://docs.unity3d.com/6000.0/Documentation/Manual/AssetMetadata.html)
- Unity documents collecting profiler data from an application on a target platform. [Target-device profiling](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html)

## Godot 4.4

- Godot exposes `--version` and `--help`; unknown command-line arguments can silently have no effect. [Command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- Some command-line options require an editor binary, while others are available in debug or release templates. [Command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- `--headless` selects the headless display and Dummy audio drivers; `--import` starts the editor, waits for resource import, and quits. [Command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- `--check-only` parses for errors when used with `--script`; it does not claim to run gameplay assertions. [Command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- Command-line export requires an editor binary, a named configured preset, and suitable export templates; relative output paths resolve against the project directory. [Command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html), [Exporting projects](https://docs.godotengine.org/en/4.4/tutorials/export/exporting_projects.html)
- Godot's debugger offers runtime collision/navigation visualization and remote-device debugging facilities. [Debugging overview](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/overview_of_debugging_tools.html)
- The 4.4 built-in profiler does not support C# scripts; its documentation points to Rider/dotTrace with Godot support. [Profiler](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/the_profiler.html)
- Scene organization guidance favors focused scenes, loose coupling, signals, and parent-supplied dependencies over hidden assumptions about the containing scene. [Scene organization](https://docs.godotengine.org/en/4.4/tutorials/best_practices/scene_organization.html)
- VCS exclusions differ across engine versions: the 4.4 guidance covers 4.1+, while 3.x and 4.0 can store credentials in export_presets.cfg. [Version control](https://docs.godotengine.org/en/4.4/tutorials/best_practices/version_control_systems.html)

## Recommended approach and caveats

The following are original GameCrafter workflow recommendations, inferred from the documented boundaries above.
They are not statements that the platform already implements these operations.

- Discover engine version, executable, SDKs, framework, connector schemas, and permitted operations before choosing commands.
- Keep skill selection separate from permission grants; discovering a tool does not authorize every operation.
- Preserve project/editor sessions and unsaved user work while coordinating process access.
- Give each run a bounded timeout, a readiness condition, an output directory, and a cleanup owner.
- Track source inspection, static checks, engine import/compile, runtime behavior, packaged behavior, and device behavior separately.
- Choose regression tests around observable outcomes rather than private implementation call counts.
- Retain runner reports and expected test counts; a zero exit code alone is insufficient evidence.
- Repeat the same reproduction after a change, and investigate intermittent failures rather than hiding them with retries.
- Retain comparable raw profiling captures and record workload, configuration, hardware, and instrumentation settings.
- Discover a Godot project test harness rather than inventing a built-in equivalent of Unity's Test Framework CLI.
- Do not claim GPU rendering correctness from headless checks or device performance from editor observations.
- Treat binary asset editing, graph editing, console deployment, and device access as capability-specific prerequisites.
- Label examples as proposed fixtures until they actually execute and produce inspected evidence.

## Sources

- [Unreal Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine?application_version=5.6)
- [Unreal Run Automation Tests](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine?application_version=5.6)
- [Unreal build operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine?application_version=5.6)
- [Unreal Blueprint best practices](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine?application_version=5.6)
- [Unreal Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine?application_version=5.6)
- [Unity Editor command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- [Unity Test Framework 1.4](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- [Unity BuildPlayer API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/BuildPipeline.BuildPlayer.html)
- [Unity asset metadata](https://docs.unity3d.com/6000.0/Documentation/Manual/AssetMetadata.html)
- [Unity target-device profiling](https://docs.unity3d.com/6000.0/Documentation/Manual/profiling-target-device.html)
- [Godot command-line tutorial](https://docs.godotengine.org/en/4.4/tutorials/editor/command_line_tutorial.html)
- [Godot exporting projects](https://docs.godotengine.org/en/4.4/tutorials/export/exporting_projects.html)
- [Godot debugging tools](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/overview_of_debugging_tools.html)
- [Godot profiler](https://docs.godotengine.org/en/4.4/tutorials/scripting/debug/the_profiler.html)
- [Godot scene organization](https://docs.godotengine.org/en/4.4/tutorials/best_practices/scene_organization.html)
- [Godot version control](https://docs.godotengine.org/en/4.4/tutorials/best_practices/version_control_systems.html)
