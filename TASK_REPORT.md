# TASK 322 Report - Implement basic in-game HUD overlays

## Summary
Implemented a reusable HUD overlay module and integrated it into overworld and battle scenes with state-driven updates (no direct device input coupling).

## Changes made
- Added `src/ui/HUDOverlay.js`:
  - Encapsulates HUD panel creation with Phaser primitives.
  - Exposes `setData({ context, primary, secondary, tertiary })` for reusable updates.
  - Caches previous payload to avoid unnecessary redraw updates.
  - Handles teardown via `destroy()`.
- Updated `src/scenes/OverworldScene.js`:
  - Integrated `HUDOverlay` at top-right of viewport.
  - HUD fields: `Unit`, `HP`, and player `Tile` coordinate.
  - Added `syncHudOverlay()` to update from scene state and only when state snapshot changes.
  - Wired cleanup on scene shutdown/destroy.
- Updated `src/scenes/BattleScene.js`:
  - Integrated `HUDOverlay` at top-right of viewport.
  - HUD fields: `Active` unit (+ HP), `Phase`, and `Turn`.
  - Added active-unit derivation from battle state (`selectedUnitId`, `currentActingUnitId`, unit lists).
  - Updated HUD from battle state transitions (`updateSelectionPanel`, enemy-turn processing, battle completion).
  - Wired cleanup on scene shutdown/destroy.
- Updated `STATUS.md`:
  - Added Task 322 section documenting HUD elements, scene integration points, and state-driven update model.

## Acceptance test check
1. New HUD module exists and encapsulates HUD creation/update: PASS (`src/ui/HUDOverlay.js`).
2. Overworld HUD shows character + HP/stat and updates when state changes: PASS (`Unit`, `HP`, `Tile`; refreshed via `syncHudOverlay()` with snapshot keying).
3. Battle HUD shows active unit and turn/phase from battle state: PASS (`Active`, `Phase`, `Turn` from battle scene state).
4. HUD code does not reference keyboard/mouse/touch directly: PASS (HUD module has no input listeners; scene HUD updates are state-driven).
5. HUD remains visible and positioned away from critical play area: PASS (fixed top-right overlay, scroll-factor 0, compact panel sizing).
6. `STATUS.md` includes HUD implementation summary and scene/state wiring: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
