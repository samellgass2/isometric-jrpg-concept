# TASK 319 Report - Implement unified input abstraction layer

## Summary
Implemented a reusable Phaser input abstraction in `src/input/InputManager.js` that maps keyboard, mouse, and touch input into semantic game actions and exposes an observer API for scene systems.

## Changes made
- Added `src/input/InputManager.js`:
  - Defines semantic actions:
    - `MOVE_UP`, `MOVE_DOWN`, `MOVE_LEFT`, `MOVE_RIGHT`
    - `CONFIRM`, `CANCEL`, `SELECT_TILE`
  - Default keyboard mappings:
    - Movement: Arrow keys + WASD
    - Confirm: Enter/Space
    - Cancel: Escape
  - Pointer/touch mapping:
    - Emits `SELECT_TILE` with `worldX/worldY`, normalized viewport coordinates, and tile coordinates (`tileX/tileY`) using configurable tile resolution.
  - Public API:
    - `onAction(callback)` / `offAction(callback)`
    - `isActionActive(action)`
    - `setActionEnabled(action, enabled)`
    - `rebindAction(action, keyNames)`
    - `unbindAction(action)`
    - `destroy()`
- Updated `src/scenes/OverworldScene.js`:
  - Replaced direct cursor/WASD key reads and raw scene pointer movement listener with `InputManager` actions.
  - Movement now reads high-level `MOVE_*` action state.
  - Interactions now use `CONFIRM` and `CANCEL` actions.
  - Click/touch path target selection now uses `SELECT_TILE` action payload tile indices.
- Updated `src/scenes/BattleScene.js`:
  - Added `InputManager` integration for tile selection via `SELECT_TILE`.
  - Added `CANCEL` action handling to reset mode/highlights.
  - Kept existing battle hotkeys (`M`, `A`, `E`, `H`) unchanged.
- Updated `STATUS.md`:
  - Added TASK 319 entry documenting module location, API, and wiring points.

## Acceptance test check
1. New file `src/input/InputManager.js` exists and exports `InputManager` with subscription API: PASS.
2. Keyboard mappings include Arrow/WASD -> `MOVE_*`, Enter/Space -> `CONFIRM`, Esc -> `CANCEL`: PASS.
3. Pointer/touch maps to `SELECT_TILE` with normalized coordinates and tile indices: PASS.
4. Existing scene integration uses high-level actions for movement/selection: PASS (`OverworldScene`, plus `BattleScene` tile select integration).
5. Binding changes are isolated to `InputManager` (`rebindAction`/`unbindAction`) with no scene logic edits required: PASS.
6. `STATUS.md` contains InputManager summary, API, and wiring usage notes: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
- Dev startup smoke:
  - `timeout 8s npm run dev` -> server started at `http://127.0.0.1:5173` before timeout.
