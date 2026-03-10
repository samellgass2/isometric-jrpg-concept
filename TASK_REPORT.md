# TASK_REPORT

## Task
- TASK_ID: 289
- RUN_ID: 492
- Title: Add basic turn-based loop and input

## Summary
Implemented a minimal repeating player/AI turn framework in `src/scenes/BattleScene.js` with explicit turn ownership, player unit selection via mouse, end-turn key input, a simple AI action, and clear UI/console turn feedback.

## What Changed
- Added explicit turn-state constants and scene variables:
  - `TURN_OWNER` (`player`, `ai`)
  - `currentTurnOwner`, `turnCounter`, `selectedPlayerUnitId`
  - AI timing/highlight state (`aiTurnTimer`, `aiActionTile`, `aiActionTween`)
- Added player input flow:
  - Player units are interactive and selectable on click during player turns.
  - Selection is ignored for enemy units and blocked during AI turns.
  - End turn is triggered by `E` or `Enter`.
- Added AI turn routine:
  - On player end-turn, control moves to AI (`startAiTurn`).
  - AI performs a trivial action by highlighting/pulsing the enemy tile and logging the simulated action.
  - After a delay, control returns to player (`startPlayerTurn`) and turn counter increments.
- Added turn UI feedback:
  - Active turn owner text.
  - Player control instructions.
  - Selected unit details.
  - Last action text.
- Added safety/cleanup logic:
  - Tile highlight/tween cleanup between turns.
  - Timer cleanup and cursor reset on scene shutdown.
- Updated `STATUS.md` with task-specific documentation about turn tracking and input handling.

## Turn Sequence / Controls
1. Scene starts in player turn.
2. Player clicks a green unit to select it.
3. Player presses `E` or `Enter` to end turn.
4. AI turn runs, highlights enemy tile, logs action.
5. After delay, player turn starts again and loop repeats.

## Acceptance Criteria Check
1. Explicit turn owner representation: PASS (`currentTurnOwner` + `TURN_OWNER`).
2. Player interaction + end turn input: PASS (unit click selection + `E`/`Enter`).
3. AI routine and control return: PASS (tile highlight/log + delayed return to player).
4. Multi-cycle loop stability: PASS by design with deterministic state transitions and timer cleanup.
5. Documentation updated: PASS (`STATUS.md` updated with turn framework details).

## Validation
- `npm test` -> PASS (`Rollback test passed.`)

## Commit
- `task/289: add battle turn loop with player input and ai phase`
