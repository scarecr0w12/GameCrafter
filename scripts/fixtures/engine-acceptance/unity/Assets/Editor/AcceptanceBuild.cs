using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;
public static class AcceptanceBuild {
    public static void Build() {
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single); new GameObject("Acceptance").AddComponent<PlayerAcceptance>(); Directory.CreateDirectory("Assets/Scenes"); EditorSceneManager.SaveScene(scene,"Assets/Scenes/Acceptance.unity");
        string output=Path.GetFullPath("Build/Acceptance.exe"); Directory.CreateDirectory(Path.GetDirectoryName(output)); var report=BuildPipeline.BuildPlayer(new[]{"Assets/Scenes/Acceptance.unity"},output,BuildTarget.StandaloneWindows64,BuildOptions.Development);
        if(report.summary.result!=BuildResult.Succeeded) throw new System.Exception("Acceptance build failed: "+report.summary.result);
    }
}
