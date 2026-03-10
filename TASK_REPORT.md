# TASK REPORT

## Task
- TASK_ID: 297
- RUN_ID: 503
- Title: Hook animal abilities into turn flow UI

## Summary of Changes
- Added a new turn-based battle scene at `src/scenes/BattleScene.js` and wired it into startup in `src/gameConfig.js`.
- Implemented clickable friendly unit selection with HUD text for selected unit identity and key combat stats (HP, movement, range, effective damage/defense).
- Added action/menu prompt text for move and attack actions and ability-focused labels:
  - Elephant: explicitly indicates obstacle-ignoring attack trait and can target enemies behind blocking tiles.
  - Cheetah: mobility trait shown and high movement is visible through larger move highlight area.
  - Dog: `Loyal Fury` state shown as active/inactive in the panel.
- Integrated existing dog danger-buff logic into battle UI feedback:
  - Buff state driven by protagonist low-HP condition.
  - Visual indicators on dog units (`FURY` label + active color shift).
  - Log messages when buff activates/deactivates.
- Added protagonist danger toggle (`H`) for quick verification of conditional buff behavior in the scene.
- Updated `STATUS.md` with a new task entry and changed-file list.

## Verification
- `npm test` - PASS
  - `Rollback test passed.`
  - `Dog conditional behavior test passed.`
- `npm run dev` - PASS (manual smoke via local server startup + HTTP request to `/`)

## Acceptance Criteria Mapping
1. Selecting elephant/cheetah/dog shows name and key stats:
   - `updateSelectionPanel()` displays selected unit name, HP, move, range, and effective combat stats.
2. Elephant over-obstacle capability is exposed:
   - UI label and action prompt call out obstacle-ignoring targeting; attack eligibility uses `canAttackOverObstacles`.
3. Cheetah high movement is visible:
   - Move mode tile highlights use each unit’s `movement.tilesPerTurn`; cheetah visibly highlights more tiles.
4. Dog danger buff has visual feedback:
   - Active state shows `FURY` icon, color shift, and log text; panel shows `Loyal Fury (ACTIVE)`.
5. Integrated with turn/input flow:
   - Selection, action modes, and end-turn loop operate within one scene without changing global input architecture.
6. No new console/runtime script errors:
   - Existing test suite passes; dev server starts and serves app successfully.
7. Status documentation updated:
   - Added TASK_ID=297 entry in `STATUS.md` and listed touched files.
