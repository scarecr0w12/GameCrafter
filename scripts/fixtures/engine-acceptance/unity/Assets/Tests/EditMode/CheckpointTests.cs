using System.IO;
using NUnit.Framework;
using UnityEngine;
public class CheckpointTests {
    [Test] public void CheckpointRestoresHealthAndPosition() {
        var path=Path.Combine(Application.temporaryCachePath, System.Guid.NewGuid()+".json");
        var obj=new GameObject("checkpoint");
        try { var checkpoint=obj.AddComponent<Checkpoint>(); checkpoint.health=37; obj.transform.position=new Vector3(2,3,4); checkpoint.Save(path); checkpoint.health=1; obj.transform.position=Vector3.zero; checkpoint.Load(path); Assert.AreEqual(37, checkpoint.health); Assert.AreEqual(new Vector3(2,3,4),obj.transform.position); }
        finally { Object.DestroyImmediate(obj); if(File.Exists(path)) File.Delete(path); }
    }
    [Test] public void MissingCheckpointIsNotSilentlyAccepted() {
        var obj=new GameObject("checkpoint");
        try { Assert.Throws<FileNotFoundException>(()=>obj.AddComponent<Checkpoint>().Load(Path.Combine(Application.temporaryCachePath,System.Guid.NewGuid()+".json"))); }
        finally { Object.DestroyImmediate(obj); }
    }
}
