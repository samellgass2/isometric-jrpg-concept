import assert from "node:assert/strict";
import {
  createInitialPlayerProgressState,
  deserializePlayerProgress,
  recordBattleOutcome,
  removePartyMember,
  serializePlayerProgress,
  updateOverworldPosition,
  upsertPartyMember,
} from "../src/state/playerProgress.js";

const initial = createInitialPlayerProgressState();
assert.equal(initial.overworld.position.x, 2);
assert.equal(initial.overworld.position.y, 2);
assert.ok(Array.isArray(initial.party.members));
assert.ok(initial.party.members.length >= 1);
assert.deepEqual(initial.battleOutcomes, {});

const moved = updateOverworldPosition(initial, { x: 7, y: 9 }, { spawnPointId: "level-1-return" });
assert.notEqual(moved, initial);
assert.deepEqual(moved.overworld.position, { x: 7, y: 9 });
assert.equal(moved.overworld.spawnPointId, "level-1-return");
assert.deepEqual(initial.overworld.position, { x: 2, y: 2 });

const withDog = upsertPartyMember(moved, {
  id: "guardian-dog",
  name: "Guardian Dog",
  archetype: "dog",
  level: 2,
  currentHp: 66,
  maxHp: 66,
});
assert.ok(withDog.party.members.some((member) => member.id === "guardian-dog"));
assert.ok(withDog.party.memberOrder.includes("guardian-dog"));

const withoutDog = removePartyMember(withDog, "guardian-dog");
assert.ok(!withoutDog.party.members.some((member) => member.id === "guardian-dog"));
assert.ok(!withoutDog.party.memberOrder.includes("guardian-dog"));

const withBattleOutcome = recordBattleOutcome(
  withDog,
  "level-1-training-ambush",
  { result: "victory", recordedAt: "2026-03-10T00:00:00.000Z" }
);
assert.deepEqual(withBattleOutcome.battleOutcomes["level-1-training-ambush"], {
  result: "victory",
  recordedAt: "2026-03-10T00:00:00.000Z",
});

const serialized = serializePlayerProgress(withBattleOutcome);
const hydrated = deserializePlayerProgress(serialized);
assert.deepEqual(hydrated, withBattleOutcome);

console.log("Player progress state test passed.");
