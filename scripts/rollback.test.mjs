import assert from "node:assert/strict";
import { createInitialGameState } from "../src/gameState.js";
import { createStateHistory } from "../src/stateHistory.js";

const initialState = createInitialGameState();
const history = createStateHistory(initialState, { maxSnapshots: 10 });

const originalSnapshot = history.getCurrent();
assert.equal(originalSnapshot.meta.turn, 1);
assert.equal(originalSnapshot.friendlyUnits[0].stats.hp, 12);

history.commit((draft) => {
  draft.meta.turn = 2;
  draft.friendlyUnits[0].stats.hp = 5;
  draft.friendlyUnits[0].status.effects.push("poisoned");
});

const modifiedSnapshot = history.getCurrent();
assert.equal(modifiedSnapshot.meta.turn, 2);
assert.equal(modifiedSnapshot.friendlyUnits[0].stats.hp, 5);
assert.deepEqual(modifiedSnapshot.friendlyUnits[0].status.effects, ["poisoned"]);

const rolledBackSnapshot = history.rollback(1);
assert.equal(rolledBackSnapshot.meta.turn, 1);
assert.equal(rolledBackSnapshot.friendlyUnits[0].stats.hp, 12);
assert.deepEqual(rolledBackSnapshot.friendlyUnits[0].status.effects, []);

assert.equal(history.getPointer(), 0);

const rereadSnapshot = history.getCurrent();
rereadSnapshot.meta.turn = 99;
assert.equal(history.getCurrent().meta.turn, 1);

assert.equal(initialState.meta.turn, 1);
assert.equal(initialState.friendlyUnits[0].stats.hp, 12);

console.log("Rollback test passed.");
