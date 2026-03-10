# TASK 312 Report - Integrate simple battle encounters into levels

## Summary
Integrated minimal end-to-end battle encounters into both Level 1 and Level 2 using the existing turn/grid/movement-targeting combat framework in `BattleScene`.

## Changes made
- Added `src/battle/encounters.js`:
  - Introduced encounter definitions:
    - `level-1-training-ambush`
    - `level-2-canyon-gauntlet`
  - Each encounter defines friendly/enemy units, spawn tiles, display name, and trigger description.
- Updated `src/scenes/BattleScene.js`:
  - Added data-driven encounter bootstrapping via `encounterId` and shared encounter definitions.
  - Reused existing battle systems (movement range, targeting, enemy turn behavior, combat resolver).
  - Added battle completion detection and resolution:
    - Victory when all enemies are defeated.
    - Defeat when all friendlies are defeated.
  - Added return flow payload to caller scene (`battleResult`, `lastEncounterId`) and configurable return target (`returnSceneKey`, `returnSceneData`).
- Updated `src/scenes/Level1Scene.js`:
  - Added tile trigger at `(6,5)` marked `AMBUSH`.
  - Stepping on this tile launches `BattleScene` encounter `level-1-training-ambush`.
  - On return, player respawns near trigger and encounter is marked cleared on victory.
- Updated `src/scenes/Level2Scene.js`:
  - Added interaction trigger object (`TOTEM`) at `(5,5)`.
  - Press `Enter`/`Space` near totem or click totem while nearby to launch `level-2-canyon-gauntlet`.
  - On return, player respawns near totem and encounter is marked cleared on victory.
- Updated `STATUS.md`:
  - Documented trigger methods for Level 1 and Level 2, battle return behavior, and current limitations.

## Acceptance test check
1. Level 1 has documented battle trigger using existing battle system: PASS.
2. Level 2 has documented trigger (interaction-based) using existing battle system: PASS.
3. Player can perform battle actions and enemies respond via existing turn flow: PASS.
4. Battle completion returns to level scenes without inconsistent state: PASS.
5. No duplicate battle engine added; existing framework extended: PASS.
6. `STATUS.md` updated with trigger locations and limitations: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
- Dev smoke check:
  - `npm run dev` + `curl -i http://127.0.0.1:5173/` returned `HTTP/1.1 200 OK`.
