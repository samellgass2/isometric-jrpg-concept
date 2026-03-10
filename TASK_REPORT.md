# TASK 329 Report - Persist party composition across sessions

## Summary
Connected battle-party management to the progress/persistence stack so active party composition, order, and key member stats survive reloads while fresh profiles keep existing encounter defaults.

## Changes made
- Added new party persistence helper module: `src/state/partyPersistence.js`
  - `hasPersistedProgressData(...)`: detects whether a real saved progress snapshot exists via `PLAYER_PROGRESS_STORAGE_KEY`.
  - `resolveInitialFriendlyUnits(...)`: reconstructs encounter-friendly party from saved `party.memberOrder` + `party.members` when saved data exists; otherwise returns encounter defaults.
  - `reconcilePartyProgressWithBattleUnits(...)`: upserts active units, removes encounter-template members no longer active, and rewrites member order with active members first.
  - `serializeUnitToPartyMember(...)`: maps runtime unit state into JSON-friendly persisted fields (`id`, `name`, `archetype`, `level`, `currentHp`, `maxHp`).

- Updated `src/scenes/BattleScene.js`
  - Imports and uses `partyPersistence` helpers for initial party load and post-battle reconciliation.
  - `getProgressState()` now supports registry-first read with `loadProgress()` fallback and normalization.
  - `commitProgress()` now supports registry setter when available, otherwise fallback save path (`saveProgress(...)`) without throwing.
  - On battle start:
    - Uses saved party composition/order only when a saved snapshot exists.
    - Keeps existing encounter default lineup on fresh profile.
  - On battle end:
    - Reconciles party add/remove/order into progress state, then records battle outcome and overworld scene key.

- Added tests: `scripts/battle-party-persistence.test.mjs`
  - Verifies fresh profile behavior keeps existing default composition.
  - Verifies saved profile restores composition order and key stats.
  - Verifies reconciliation add/remove/order logic and JSON round-trip safety.

- Updated `package.json`
  - Added new test script to `npm test` chain.

- Updated `STATUS.md`
  - Added Task 329 entry describing architecture, persisted field mapping, and in-memory reconstruction path.

## Acceptance test check
1. Party management module imports progress + persistence utilities: PASS (`BattleScene` + `partyPersistence`).
2. Party initializes from progress when saved data exists: PASS.
3. Fresh profile preserves existing default composition/gameplay: PASS.
4. Party add/remove reconciliation updates progress and triggers save path without errors: PASS.
5. Reload restoration path implemented through localStorage-backed progress model: PASS.
6. Persisted party data remains JSON-friendly and round-trippable: PASS.
7. `STATUS.md` documents saved fields and conversion back to runtime units: PASS.

## Validation run
- `npm test` -> PASS
  - Rollback test passed.
  - Dog conditional behavior test passed.
  - Battle grid stats test passed.
  - Player progress state test passed.
  - Save system persistence test passed.
  - Battle party persistence test passed.
