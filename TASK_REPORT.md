# TASK 320 Report - Wire input layer into overworld controls

## Summary
Refactored overworld controls to rely on `InputManager` action callbacks and removed the remaining direct sign pointer listeners from `OverworldScene`.

## Changes made
- Updated `src/scenes/OverworldScene.js`:
  - Removed direct per-sign pointer listeners (`sign.on("pointerdown", ...)`) and associated handler method.
  - Kept movement driven by `InputManager` `MOVE_*` action state polling.
  - Kept keyboard interaction flow driven by `CONFIRM` / `CANCEL` actions.
  - Preserved pointer/touch movement through `SELECT_TILE` action handling.
  - Added tile-target interaction routing through `SELECT_TILE` callbacks:
    - Nearby sign tile selection opens sign prompt.
    - Selecting the same nearby sign tile again while prompt is open confirms travel.
    - Nearby NPC tile selection opens NPC dialogue.
  - Updated sign prompt text to reflect current abstraction-driven controls.
- Updated `STATUS.md`:
  - Added TASK 320 entry documenting the integration, validation notes, and known edge cases.

## Acceptance test check
1. Overworld imports/uses `InputManager`: PASS.
2. Overworld movement works via keyboard and pointer/touch abstraction semantics (`MOVE_*` + `SELECT_TILE`): PASS.
3. Interaction no longer depends on scene keycodes/raw pointer listeners; keyboard uses `CONFIRM` and tile interactions come through `InputManager` action callbacks: PASS.
4. Overworld contains no direct Phaser keyboard keycode usage or raw pointer event listeners for input logic: PASS.
5. Input binding changes remain isolated in `InputManager`; overworld logic remains unchanged for rebinds: PASS.
6. `STATUS.md` updated with overworld InputManager integration and limitations: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
