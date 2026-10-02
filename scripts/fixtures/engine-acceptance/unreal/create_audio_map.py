import unreal
path = '/Game/AudioAcceptance'
editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if unreal.EditorAssetLibrary.does_asset_exist(path):
    editor.load_level(path)
else:
    editor.new_level(path)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actor_class = unreal.load_class(None, '/Script/Acceptance.AudioAcceptanceActor')
if not any(actor.get_class() == actor_class for actor in actors.get_all_level_actors()):
    actors.spawn_actor_from_class(actor_class, unreal.Vector(0, 0, 0))
editor.save_current_level()
unreal.log('GAMECRAFTER_AUDIO_MAP_READY')
