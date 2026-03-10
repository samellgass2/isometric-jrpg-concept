# TASK REPORT

## Task
- TASK_ID: 294
- RUN_ID: 499
- Title: Define animal unit stats and abilities

## Summary of Changes
- Added a new battle unit data module at `src/battle/units/animalUnits.js`.
- Implemented a structured config schema for animal units with shared fields:
  - `stats.maxHp`
  - `stats.defense`
  - `movement.tilesPerTurn`
  - `attack.range`
  - `attack.baseDamage`
  - ability trigger/effect metadata
- Added concrete exports for required units:
  - `elephantUnit`
  - `cheetahUnit`
  - `guardianDogUnit` (plus `scoutDogUnit` as an additional dog variant)
- Encoded narrative-specific rules in data:
  - Elephant: very high defense, slow movement, and `attack.canAttackOverObstacles: true`
  - Cheetah: very high movement with lower HP/defense than elephant and dogs
  - Dogs: conditional protagonist-danger ability with low-HP trigger (`thresholdPercent: 35`) and combat boost effect metadata
- Added aggregate exports for future battle/turn integration:
  - `animalUnits`
  - `animalUnitList`
  - `getAnimalUnitConfig(unitKey)`
  - default export (`animalUnits`)
- Updated `src/gameConfig.js` to import the new module through `battleUnitCatalog.animals`, ensuring startup-time import compatibility.
- Updated `STATUS.md` with a new task entry summarizing where the unit model lives and how it is intended to be used.

## Verification
- `node --input-type=module -e "import('./src/battle/units/animalUnits.js')..."` - PASS (module imports and exports resolved)
- `npm test` - PASS (`Rollback test passed.`)
- `npm run dev` + `curl -i http://127.0.0.1:5173/` - PASS (`HTTP/1.1 200 OK`)

## Acceptance Criteria Mapping
1. Animal unit module exists with elephant/cheetah/dog exports:
   - Satisfied by `src/battle/units/animalUnits.js` named exports.
2. Unit configs include HP, defense, movement, attack range, and base damage:
   - Satisfied via structured `stats`, `movement`, and `attack` objects.
3. Elephant has high defense, lower movement, and obstacle-over attack capability:
   - Satisfied (`defense: 24`, `tilesPerTurn: 2`, `canAttackOverObstacles: true`).
4. Cheetah has significantly higher movement and lower survivability:
   - Satisfied (`tilesPerTurn: 7`, `maxHp: 95`, `defense: 6`).
5. Dog unit references protagonist danger/low HP and combat boost effect:
   - Satisfied by `loyal-fury` and `pack-protect` conditional triggers/effects.
6. No runtime errors when importing module / running dev:
   - Satisfied by import smoke check and dev startup test.
7. STATUS.md includes summary of new definitions/location:
   - Satisfied by top entry for TASK_ID=294.
