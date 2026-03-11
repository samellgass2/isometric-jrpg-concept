# Task 427 Report

## Summary
Integrated character progression so overworld and battle share the same authoritative party state for HP, level, XP, and stat growth.

## Implemented
- Added centralized battle party resolver in `src/state/gameState.js`:
  - `buildBattlePartyFromEncounterTemplates(friendlyUnits)`
  - Battle friendlies now come from shared state first, with missing non-drone members seeded from encounter templates.
- Updated `src/scenes/BattleScene.js`:
  - Replaced local merge/clone battle-party resolver with shared state resolver.
  - Battle unit HUD/selection now shows `Lv` and `XP`.
  - Added progression visibility hooks:
    - battle log lines with `[Progression <stage>] ...`
    - structured console logs (`[BattleScene] Progression snapshot`) at battle entry and post-resolution.
- Updated `src/scenes/OverworldScene.js`:
  - Overworld HUD now always reads protagonist HP/Lv/XP from central state.
  - Debug panel now shows party Lv/XP/HP for all members.
- Updated `src/state/gameState.js` XP award logic:
  - Drone-flagged units are skipped for persistent XP gain.
- Updated `src/persistence/runtimeStateTools.js` debug snapshot fields:
  - Added `currentXP`, `xpToNextLevel`, `isDrone`.
- Added/extended test coverage in `scripts/game-state-model.test.mjs`:
  - Validates encounter roster resolution adds elephant and keeps drone non-persistent.
  - Validates drone party member does not gain persistent XP.

## Acceptance Criteria Check
1. Battle entry stats match shared state: PASS
   - Battle friendlies are now built by `buildBattlePartyFromEncounterTemplates(...)` from central state.
2. XP/levels persist into overworld and subsequent encounters: PASS
   - XP awards mutate shared state, overworld HUD/debug reads same state, and later battles rehydrate from state.
3. No divergent independent stat copies in transition flow: PASS
   - Removed BattleScene local party merge path; centralized in state model logic.
4. Simple UI/logging to verify progression: PASS
   - Overworld HUD/debug panel + battle progression logs and structured console output.
5. Elephant/cheetah/dog progression and drone non-persistence behavior: PASS
   - Encounter resolver seeds/persists non-drone party members; drones explicitly skipped for persistent XP.
6. STATUS updated with touched modules and test guidance: PASS
   - Added Task 427 section in `STATUS.md`.

## Validation
- Ran `npm test` successfully after changes.

## Commit
- `task/427: unify progression state across overworld and battle`
