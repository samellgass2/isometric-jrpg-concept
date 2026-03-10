# TASK_REPORT

## Task
- TASK_ID: 290
- RUN_ID: 493
- Title: Enable basic tile and unit interaction

## Summary
Implemented turn-gated click interaction in `src/scenes/BattleScene.js` for both player units and grid tiles, with explicit handlers, visual selection feedback, and UI/console reporting of selected unit IDs and tile coordinates.

## What Changed
- Added target tile interaction state:
  - `selectedTargetTileId`
  - `turnTargetText` UI label
- Extended tile color states:
  - `targetFill` and `targetStroke` for persistent target highlight.
- Added structured input methods:
  - `addTileInputHandlers()`
  - `handleUnitPointerDown(unitId)`
  - `handleTilePointerDown(row, col)`
  - `trySelectTargetTile(row, col)`
- Kept unit selection flow centralized:
  - `trySelectPlayerUnit(unitId)` remains the player-unit selector.
- Added explicit turn gating for clicks:
  - Unit and tile clicks are ignored when `currentTurnOwner !== TURN_OWNER.player`.
  - Ignored interactions write history text and console logs.
- Added tile visual refresh helper:
  - `updateTileVisuals()` to re-apply base/target/AI tile styles consistently.
- Updated turn transitions to reset intent state:
  - `startPlayerTurn` and `startAiTurn` now clear `selectedTargetTileId` and refresh visuals.
- Updated in-scene instructional/debug text positioning to include target selection feedback.
- Updated `STATUS.md` with the interaction model, click-to-action mapping, and current limitations.

## Interaction Model
1. Player turn only:
   - Click green player unit -> selects that unit (scale/stroke + UI/history update).
   - Click tile -> stores logical tile id `row,col`, highlights tile, logs coordinates.
2. If unit + tile are selected:
   - Tile click is treated as a provisional target assignment for the selected unit.
3. AI turn:
   - Tile/unit click handlers short-circuit and do not mutate selection state.

## Current Limitations
- Selection currently captures intent only.
- No movement execution, pathfinding, attack resolution, range checking, AP/turn cost, or confirmation step yet.

## Acceptance Criteria Check
1. Player unit click selects visible player unit: PASS (unit highlight + history/UI).
2. Tile click identifies logical coordinates: PASS (`row,col` displayed/logged).
3. Interaction gated by turn state: PASS (AI-turn click handlers ignore input).
4. Structured logic: PASS (dedicated handler methods).
5. Documentation updated: PASS (`STATUS.md` updated for TASK_ID=290).

## Validation
- `npm test` -> PASS (`Rollback test passed.`)

## Commits
- `task/290: add turn-gated battle tile and unit selection`
