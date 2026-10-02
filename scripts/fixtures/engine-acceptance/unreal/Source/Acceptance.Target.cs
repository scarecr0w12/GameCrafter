using UnrealBuildTool;
public class AcceptanceTarget : TargetRules { public AcceptanceTarget(TargetInfo Target) : base(Target) { Type=TargetType.Game; DefaultBuildSettings=BuildSettingsVersion.V7; IncludeOrderVersion=EngineIncludeOrderVersion.Unreal5_8; ExtraModuleNames.Add("Acceptance"); } }
