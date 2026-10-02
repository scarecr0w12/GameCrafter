using System;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class ExtendedAcceptanceBuild {
    public static void Windows() { Build(BuildTarget.StandaloneWindows64,"ExtendedBuild/Windows/Acceptance.exe"); }
    public static void Linux() { Build(BuildTarget.StandaloneLinux64,"ExtendedBuild/Linux/Acceptance.x86_64"); }
    public static void Web() { Build(BuildTarget.WebGL,"ExtendedBuild/WebGL"); }
    private static void Build(BuildTarget target,string output) {
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        Directory.CreateDirectory("Assets/Acceptance");
        using(var writer=new BinaryWriter(File.Create("Assets/Acceptance/Tone.wav"))) {
            const int count=48000; writer.Write(Encoding.ASCII.GetBytes("RIFF")); writer.Write(36+count*2);
            writer.Write(Encoding.ASCII.GetBytes("WAVEfmt ")); writer.Write(16); writer.Write((short)1); writer.Write((short)1);
            writer.Write(48000); writer.Write(96000); writer.Write((short)2); writer.Write((short)16);
            writer.Write(Encoding.ASCII.GetBytes("data")); writer.Write(count*2);
            for(int i=0;i<count;i++) writer.Write((short)(Math.Sin(2*Math.PI*440*i/48000)*32767));
        }
        AssetDatabase.ImportAsset("Assets/Acceptance/Tone.wav",ImportAssetOptions.ForceSynchronousImport);
        var importer=(AudioImporter)AssetImporter.GetAtPath("Assets/Acceptance/Tone.wav");
        var audioSettings=importer.defaultSampleSettings; audioSettings.loadType=AudioClipLoadType.DecompressOnLoad;
        importer.defaultSampleSettings=audioSettings; importer.SaveAndReimport();
        new GameObject("Extended Acceptance").AddComponent<ExtendedAcceptance>().testTone=AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Acceptance/Tone.wav");
        // Include the shader in the scene so stripping does not remove a runtime-created material's dependency.
        var reference=GameObject.CreatePrimitive(PrimitiveType.Cube); reference.SetActive(false);
        Directory.CreateDirectory("Assets/Acceptance");
        var material=AssetDatabase.LoadAssetAtPath<Material>("Assets/Acceptance/Neon.mat");
        if(material==null) { material=new Material(Shader.Find("Unlit/Color")); AssetDatabase.CreateAsset(material,"Assets/Acceptance/Neon.mat"); }
        reference.GetComponent<Renderer>().sharedMaterial=material;
        Directory.CreateDirectory("Assets/Scenes"); EditorSceneManager.SaveScene(scene,"Assets/Scenes/ExtendedAcceptance.unity");
        Directory.CreateDirectory(Path.GetDirectoryName(output));
        var report=BuildPipeline.BuildPlayer(new[]{"Assets/Scenes/ExtendedAcceptance.unity"},output,target,BuildOptions.Development);
        if(report.summary.result!=BuildResult.Succeeded) throw new Exception("Extended acceptance build failed: "+report.summary.result);
    }
}
