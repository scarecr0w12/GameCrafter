using System.Collections;
using System.IO;
using UnityEngine;
public class PlayerAcceptance : MonoBehaviour {
    IEnumerator Start() {
        var output=Path.Combine(Application.dataPath,"..","player-acceptance.json");
        var save=Path.Combine(Application.temporaryCachePath,System.Guid.NewGuid()+".json");
        var first=new GameObject("first life"); var checkpoint=first.AddComponent<Checkpoint>(); checkpoint.health=73; first.transform.position=new Vector3(4,5,6); checkpoint.Save(save); Destroy(first); yield return null;
        var second=new GameObject("respawn"); var restored=second.AddComponent<Checkpoint>(); restored.Load(save);
        bool passed=first==null && restored.health==73 && second.transform.position==new Vector3(4,5,6);
        File.Delete(save); File.WriteAllText(output,"{\"passed\":"+(passed?"true":"false")+",\"assertions\":3,\"engine\":\""+Application.unityVersion+"\"}"); Application.Quit(passed?0:1);
    }
}
