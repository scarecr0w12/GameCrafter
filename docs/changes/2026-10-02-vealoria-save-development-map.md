# Save Vealoria's initial development map

**Release:** 0.2.0

**Impact:** none

**Category:** Maintenance

## Summary

Preserve the open unsaved Vealoria landscape as a named development map and configure it as the game's default map and editor startup map.

## Details

- Saved the current `/Temp/Untitled_1` world through CodeFizz's native `save_level_as` command as `/Game/Maps/L_Vealoria_Development`, after checking that the destination did not exist and that Vealoria was the selected running editor. This preserves the existing landscape rather than replacing it. It remains a development map, not proof of MMORPG gameplay.
- External files changed: `E:/GameCrafter-Dev/vealoria/game/Vealoria/Config/DefaultEngine.ini` and new map/World Partition asset packages under Vealoria's Content directory. The exact generated paths are retained in `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP_ASSETS.md`. Updated project evidence in `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP.md`.
- Set GameDefaultMap and EditorStartupMap to the saved development map in configuration and the running editor settings. No engine restart, asset replacement, plugin removal or multiplayer architecture decision was made. The optional MLAdapter warning remains; no neural model was invented or configured solely to suppress it.

## Validation

- CodeFizz save command returned success. The map file exists, and subsequent live project context reported `/Game/Maps/L_Vealoria_Development` as the open map. Editor settings inspection succeeded after an initial result-formatting error; the configuration file names both saved-map defaults explicitly.
- After explicit user approval, PlayWeld DataValidation run `01a0fec6-0a4c-7637-8916-d79a96310eb7` exited 0: 3 assets and 143 associated objects were checked, with 0 errors and the existing MLAdapter warning. The native editor remained open on the saved map. Runtime gameplay, cook/package, map reopen and World Partition streaming verification remain untested.

## Files

- `docs/changes/2026-10-02-vealoria-save-development-map.md`
