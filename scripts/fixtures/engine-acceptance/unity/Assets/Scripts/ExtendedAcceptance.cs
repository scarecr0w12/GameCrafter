using System;
using System.Collections;
using System.IO;
using UnityEngine;

// Measures real renderer/DSP output. Physical device input is a separate acceptance check.
public class ExtendedAcceptance : MonoBehaviour {
    [Serializable] public class Result {
        public bool passed, renderPassed, audioPassed, pausePassed, resumePassed;
        public string engine, platform, graphicsDevice, graphicsApi, audioProbe;
        public int audioSampleRate, greenPixels, frames, physicalInputEvents;
        public double audioPeak, pausedPeak, resumedPeak, averageFrameMs;
        public long managedMemoryBytes;
    }
    private Result result = new Result();
    private Camera cameraView;
    private string output;
    public AudioClip testTone;
    void Update() {
        result.frames++;
        if (Input.GetKeyDown(KeyCode.Space)) result.physicalInputEvents++;
    }
    IEnumerator Start() {
        string[] args=Environment.GetCommandLineArgs();
        int index=Array.IndexOf(args,"-acceptanceOutput");
        output=index>=0 && index+1<args.Length ? args[index+1] : Path.Combine(Application.persistentDataPath,"extended-acceptance.json");
        result.engine=Application.unityVersion; result.platform=Application.platform.ToString();
        result.graphicsDevice=SystemInfo.graphicsDeviceName; result.graphicsApi=SystemInfo.graphicsDeviceType.ToString();
        result.audioSampleRate=AudioSettings.outputSampleRate;
        Application.runInBackground=true; QualitySettings.vSyncCount=0; Application.targetFrameRate=60;
        var cameraObject=new GameObject("Acceptance Camera");
        cameraView=cameraObject.AddComponent<Camera>(); cameraObject.AddComponent<AudioListener>();
        cameraView.transform.position=new Vector3(0,0,-5); cameraView.clearFlags=CameraClearFlags.SolidColor;
        cameraView.backgroundColor=new Color(0.045f,0.015f,0.09f); cameraView.orthographic=true; cameraView.orthographicSize=2;
        var cube=GameObject.CreatePrimitive(PrimitiveType.Cube);
        var shader=Shader.Find("Unlit/Color");
        if(shader==null) { File.WriteAllText(output,"{\"passed\":false,\"error\":\"Unlit/Color missing\"}"); Application.Quit(1); yield break; }
        cube.GetComponent<Renderer>().material=new Material(shader) { color=new Color(0.15f,1,0.04f) };
        var source=gameObject.AddComponent<AudioSource>(); source.loop=true; source.volume=0.2f;
        source.clip=testTone; source.Play(); Debug.Log("GAMECRAFTER_AUDIO playing");
        bool web=Application.platform==RuntimePlatform.WebGLPlayer;
        result.audioProbe=web?"External browser analyser required":"AudioSource.GetOutputData";
        double started=Time.realtimeSinceStartupAsDouble;
        // DSP readiness is asynchronous; require actual samples within a bounded startup window.
        for(int attempt=0;attempt<(web?20:100);attempt++) {
            yield return new WaitForSecondsRealtime(0.1f); result.audioPeak=Peak(source);
            if(result.audioPeak>0.01) break;
        }
        result.audioPassed=result.audioPeak>0.01 && source.isPlaying;
        source.Pause(); Debug.Log("GAMECRAFTER_AUDIO paused"); yield return new WaitForSecondsRealtime(0.5f);
        result.pausedPeak=Peak(source); result.pausePassed=!source.isPlaying && result.pausedPeak<0.001;
        source.UnPause(); Debug.Log("GAMECRAFTER_AUDIO resumed"); yield return new WaitForSecondsRealtime(1);
        result.resumedPeak=Peak(source); result.resumePassed=source.isPlaying && result.resumedPeak>0.01;
        var target=new RenderTexture(256,256,24); cameraView.targetTexture=target; cameraView.Render();
        var previous=RenderTexture.active; RenderTexture.active=target;
        var pixels=new Texture2D(256,256,TextureFormat.RGB24,false); pixels.ReadPixels(new Rect(0,0,256,256),0,0); pixels.Apply();
        foreach(var color in pixels.GetPixels32()) if(color.g>180 && color.g>color.r*2 && color.g>color.b*2) result.greenPixels++;
        result.renderPassed=result.graphicsApi!="Null" && result.greenPixels>1000;
        File.WriteAllBytes(Path.ChangeExtension(output,"png"),pixels.EncodeToPNG());
        RenderTexture.active=previous; cameraView.targetTexture=null; target.Release(); Destroy(target); Destroy(pixels);
        result.averageFrameMs=(Time.realtimeSinceStartupAsDouble-started)*1000/Math.Max(1,result.frames);
        result.managedMemoryBytes=GC.GetTotalMemory(false);
        result.passed=result.renderPassed && (web || (result.audioPassed && result.pausePassed && result.resumePassed));
        File.WriteAllText(output,JsonUtility.ToJson(result,true));
        Debug.Log("GAMECRAFTER_ACCEPTANCE "+JsonUtility.ToJson(result));
        if(Application.platform!=RuntimePlatform.WebGLPlayer) Application.Quit(result.passed?0:1);
    }
    private static double Peak(AudioSource source) {
        if(Application.platform==RuntimePlatform.WebGLPlayer) return 0;
        var samples=new float[1024]; source.GetOutputData(samples,0); double peak=0;
        foreach(var sample in samples) peak=Math.Max(peak,Math.Abs(sample)); return peak;
    }
    void OnGUI() {
        GUI.color=new Color(0.3f,1,0.1f);
        GUI.Label(new Rect(30,30,700,35),"GAMECRAFTER | GRAPHICS + AUDIO ACCEPTANCE");
        GUI.Label(new Rect(30,65,700,35),"Press SPACE for physical input evidence. Events: "+result.physicalInputEvents);
    }
}
