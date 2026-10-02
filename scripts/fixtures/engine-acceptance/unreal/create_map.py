import unreal

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if unreal.EditorAssetLibrary.does_asset_exist('/Game/Acceptance'):
    assert level.load_level('/Game/Acceptance')
else:
    assert level.new_level('/Game/Acceptance')
actor_class = unreal.load_class(None, '/Script/Acceptance.AcceptanceActor')
assert actor_class is not None
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
existing = [actor for actor in actors.get_all_level_actors() if actor.get_class() == actor_class]
if not existing:
    actor = actors.spawn_actor_from_class(actor_class, unreal.Vector(0, 0, 0))
    assert actor is not None
else:
    assert len(existing) == 1
assert level.save_current_level()
unreal.log('GAMECRAFTER_MAP_ACCEPTANCE_PASSED')
