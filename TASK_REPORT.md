# TASK 311 Report - Wire sign interactions to level loading flow

## Summary
Implemented full overworld level-sign transition flow for Level 1 and Level 2 using dedicated Phaser scenes, with return routing back to overworld and documented navigation flow.

## Changes made
- Added `src/scenes/Level1Scene.js` (`Level1Scene`):
  - Distinct Training Grounds layout, visuals, camera behavior, and movement grid.
  - Keyboard + mouse movement.
  - Return to overworld via `Esc` or interact (`Space`/`Enter`) near exit marker.
  - Returns with `scene.start("OverworldScene", { spawnPointId: "level-1-return" })`.
- Added `src/scenes/Level2Scene.js` (`Level2Scene`):
  - Distinct Canyon Crossing layout, visuals, and traversal setup.
  - Keyboard + mouse movement.
  - Return to overworld via `Esc` or interact (`Space`/`Enter`) near exit marker.
  - Returns with `scene.start("OverworldScene", { spawnPointId: "level-2-return" })`.
- Updated `src/scenes/OverworldScene.js`:
  - Added sign-to-scene mapping:
    - `sign-level-1 -> Level1Scene`
    - `sign-level-2 -> Level2Scene`
  - Replaced placeholder sign confirmation with real Phaser scene transitions.
  - Added mouse travel confirmation by clicking the same sign again while prompt is open.
  - Added return spawn routing with `spawnPointId` support in `create(data)`.
  - Added spawn map for sensible return tiles near each sign.
- Updated `src/gameConfig.js`:
  - Registered `Level1Scene` and `Level2Scene` in scene config.
- Updated `STATUS.md`:
  - Documented level loading structure, scene names, sign wiring, and return flow.

## Acceptance test check
1. Level 1 sign interaction now transitions to a distinct `Level1Scene` (PASS).
2. Level 2 sign interaction now transitions to a distinct `Level2Scene` (PASS).
3. Level 1 returns to overworld via `Esc` or exit interaction with sensible spawn (PASS).
4. Level 2 returns similarly via `Esc` or exit interaction with sensible spawn (PASS).
5. Phaser scene transitions are used consistently (`scene.start`) with fade handoff flow (PASS).
6. Both scenes are in dedicated files and registered centrally in `gameConfig.js` (PASS).
7. `STATUS.md` documents wiring and navigation flow (PASS).

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
- Dev server smoke check:
  - `npm run dev` + HTTP check to `http://127.0.0.1:5173/` returned `200`.

## Commit
- `0063017` - `task/311: wire overworld signs to level scene flow`
