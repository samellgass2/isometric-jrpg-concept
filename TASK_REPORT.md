# TASK 321 Report - Connect input abstraction to battle actions

## Summary
Integrated battle controls in `BattleScene` with `InputManager` high-level actions and removed direct battle key listeners.

## Changes made
- Updated `src/scenes/BattleScene.js`:
  - Kept battle input subscription through `InputManager` action events.
  - Removed direct Phaser keyboard listeners (`keydown-M`, `keydown-A`, `keydown-E`, `keydown-H`) from battle logic.
  - Added action-driven cursor state for tile navigation (`MOVE_UP`, `MOVE_DOWN`, `MOVE_LEFT`, `MOVE_RIGHT`).
  - Routed pointer/touch tile taps (`SELECT_TILE`) to the same confirm path used by keyboard.
  - Added command mode and command selection (`move`, `attack`, `end-turn`) driven by `CONFIRM` and `MOVE_*`.
  - Added target confirmation for move/attack modes via `CONFIRM`.
  - Added cancel/back behavior via `CANCEL` for target mode and command mode.
  - Updated battle HUD text so displayed controls match the InputManager-based actions.
- Updated `STATUS.md`:
  - Added TASK 321 section documenting the battle input integration and supported action mappings.

## Acceptance test check
1. Primary battle scene imports/uses `InputManager`: PASS.
2. Unit/tile selection supports pointer/touch (`SELECT_TILE`) and keyboard cursor navigation (`MOVE_*`) through InputManager: PASS.
3. Confirm and cancel behavior uses `CONFIRM` / `CANCEL` in battle logic without raw key codes: PASS.
4. Previous direct battle input listeners were removed from battle code: PASS.
5. Control mapping remains binding-driven from `InputManager` action bindings: PASS.
6. `STATUS.md` updated with integration summary and supported battle actions: PASS.

## Validation run
- `npm install` -> PASS
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
