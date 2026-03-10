# TASK 330 Report - Record and restore key battle outcome flags

## Summary
Extended the save/load model with a dedicated key-battle outcome flag structure and wired battle completion + scene load behavior so key encounters persist across runs and visibly alter game flow.

## Changes made
- Updated progress schema in `src/state/playerProgress.js`
  - Added `battleOutcomes.keyBattles` with stable boolean flags:
    - `level1TrainingAmbushCleared`
    - `level2CanyonGauntletCleared`
  - Added `battleOutcomes.encounterResults` for per-encounter outcome history.
  - Added helpers:
    - `getBattleOutcomeFlag(...)`
    - `setBattleOutcomeFlag(...)`
    - `resolveKeyBattleOutcomeFlagForEncounter(...)`
  - Updated `recordBattleOutcome(...)` to write to `encounterResults` and auto-set mapped key flags on victory.
  - Preserved backward compatibility by normalizing legacy flat `battleOutcomes[encounterId]` saves into the new shape.

- Updated battle resolution hook in `src/scenes/BattleScene.js`
  - On battle completion, persists outcome history and mapped key-battle flags through existing progress/save utilities.

- Updated scene load-time consumption of outcome flags
  - `src/scenes/Level1Scene.js`
    - Reads persisted progress on create.
    - If `level1TrainingAmbushCleared` is true, marks encounter as cleared, keeps cleared visuals, and prevents retrigger.
  - `src/scenes/Level2Scene.js`
    - Reads persisted progress on create.
    - If `level2CanyonGauntletCleared` is true, marks encounter as cleared and prevents retrigger.
  - `src/scenes/OverworldScene.js`
    - Uses persisted key-battle flags to unlock alternate NPC dialogue:
      - Ranger Sol after Level 1 ambush clear.
      - Mechanic Ivo after Level 2 gauntlet clear.

- Updated tests
  - `scripts/player-progress.test.mjs`
    - Validates new `battleOutcomes` structure.
    - Validates automatic key-flag updates on recorded victory.
    - Validates explicit flag setting/getting.
    - Validates legacy save normalization into new structure.

- Updated documentation
  - `STATUS.md` now includes Task 330 section listing each persisted battle outcome flag, when it is set, and where it changes behavior on load.

## Acceptance test check
1. Dedicated battle outcome structure with stable descriptive keys: PASS (`battleOutcomes.keyBattles`).
2. Battle resolution/controller updates relevant flags via progress/persistence path: PASS (`BattleScene.persistBattleProgress`).
3. At least one encounter wired to set persistent outcome flag: PASS (Level 1 and Level 2 encounters).
4. Subsequent runs check stored flags and visibly change behavior: PASS (encounter retrigger prevention + NPC dialogue unlocks).
5. Flags serialize/restore through localStorage save/load layer: PASS (`normalize/serialize/deserialize` + `saveSystem` path).
6. Non-wired battles continue functioning: PASS (default encounter flow unchanged).
7. `STATUS.md` documents each persisted flag and load-time behavior: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
  - Player progress state test passed.
  - Save system persistence test passed.
  - Battle party persistence test passed.
