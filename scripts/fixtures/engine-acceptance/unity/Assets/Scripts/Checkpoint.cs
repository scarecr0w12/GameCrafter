using System;
using System.IO;
using UnityEngine;
[Serializable] public class CheckpointData { public int health; public Vector3 position; }
public class Checkpoint : MonoBehaviour {
    public int health = 100;
    public void Save(string path) { File.WriteAllText(path, JsonUtility.ToJson(new CheckpointData { health=health, position=transform.position })); }
    public void Load(string path) { var data=JsonUtility.FromJson<CheckpointData>(File.ReadAllText(path)); health=data.health; transform.position=data.position; }
}
