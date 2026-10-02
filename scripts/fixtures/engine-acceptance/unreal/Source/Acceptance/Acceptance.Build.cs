using UnrealBuildTool;
public class Acceptance : ModuleRules { public Acceptance(ReadOnlyTargetRules Target) : base(Target) { PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs; PublicDependencyModuleNames.AddRange(new[]{"Core","CoreUObject","Engine","AudioMixer"}); } }
