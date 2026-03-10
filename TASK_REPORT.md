# TASK 328 Report - Wire overworld position into save system

## Summary
Integrated overworld spawn/movement with persisted player progress so the player's overworld coordinates restore across reloads, while preserving default spawn behavior for fresh/corrupt save data.

## Changes made
- Updated `src/scenes/OverworldScene.js`:
  - Added imports from player progress and persistence layers:
    - `normalizePlayerProgressState`, `updateOverworldPosition`
    - `loadProgress`, `saveProgress`
  - Corrected spawn initialization precedence so saved coordinates are respected:
    1. Explicit transition `spawnPointId` (if provided by scene data)
    2. Saved `overworld.position`
    3. Saved `overworld.spawnPointId`
    4. Default spawn (`2,2`)
  - Hardened progress read path:
    - Prefer `game.registry.get("playerProgress")`
    - Fallback to `loadProgress()` when registry state is unavailable
    - Normalize in both paths
  - Hardened progress write path:
    - Prefer `game.registry.get("setPlayerProgress")`
    - Fallback to direct registry set + `saveProgress(normalized)`
  - Kept existing tile-change persistence behavior via `persistOverworldProgress(...)` so successful movement updates localStorage-backed progress.

- Updated `STATUS.md`:
  - Added Task 328 entry with manual QA walkthrough for move -> refresh -> restored spawn verification.
  - Included fresh profile and corrupt localStorage fallback checks.

## Acceptance test check
1. Overworld imports player progress + persistence utilities: PASS.
2. Scene init uses loaded progress for starting coordinates when available: PASS.
3. Fresh profile still uses default spawn coordinates: PASS.
4. Movement updates persisted overworld position in localStorage-backed progress: PASS.
5. Refresh restores last saved overworld tile instead of original default: PASS.
6. Missing/corrupt localStorage safely falls back without runtime errors: PASS.
7. `STATUS.md` includes QA walkthrough: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
  - Player progress state test passed.
  - Save system persistence test passed.
