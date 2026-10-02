using System.Collections;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
public class LifecycleTests {
    [UnityTest] public IEnumerator RespawnRestoresPersistedCheckpoint() {
        var path=Path.Combine(Application.temporaryCachePath,System.Guid.NewGuid()+".json");
        var first=new GameObject("first life"); var checkpoint=first.AddComponent<Checkpoint>(); checkpoint.health=61; first.transform.position=new Vector3(7,8,9); checkpoint.Save(path); Object.Destroy(first); yield return null;
        var second=new GameObject("respawn"); try { var restored=second.AddComponent<Checkpoint>(); restored.Load(path); Assert.AreEqual(61,restored.health); Assert.AreEqual(new Vector3(7,8,9),second.transform.position); Assert.IsTrue(first==null); }
        finally { Object.Destroy(second); File.Delete(path); }
    }
    [UnityTest] public IEnumerator PhysicsMovesDynamicBody() {
        var obj=new GameObject("falling body"); var body=obj.AddComponent<Rigidbody>(); obj.transform.position=Vector3.up*10; float initial=obj.transform.position.y;
        try { for(int i=0;i<10;i++) yield return new WaitForFixedUpdate(); Assert.Less(obj.transform.position.y,initial); }
        finally { Object.Destroy(obj); }
    }
}
