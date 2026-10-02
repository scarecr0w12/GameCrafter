import json
import os
import unreal

result = {
    'schemaVersion': 1,
    'passed': True,
    'engine': unreal.SystemLibrary.get_engine_version(),
    'scope': 'Linux Python commandlet startup only',
}
saved = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())
os.makedirs(saved, exist_ok=True)
with open(os.path.join(saved, 'linux-acceptance.json'), 'w') as handle:
    json.dump(result, handle, indent=2)
unreal.log('GAMECRAFTER_LINUX_ACCEPTANCE ' + json.dumps(result))
