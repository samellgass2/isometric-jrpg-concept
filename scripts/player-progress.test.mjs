import assert from "node:assert/strict";
import {
  createInitialPlayerProgressState,
  normalizePlayerProgressState,
  deserializePlayerProgress,
  getBattleOutcomeFlag,
  getQuestFlag,
  KEY_BATTLE_OUTCOME_FLAGS,
  recordBattleOutcome,
  removePartyMember,
  serializePlayerProgress,
  setBattleOutcomeFlag,
  setQuestFlag,
  setQuestFlags,
  updateOverworldPosition,
  upsertPartyMember,
} from "../src/state/playerProgress.js";

const initial = createInitialPlayerProgressState();
assert.equal(initial.overworld.position.x, 2);
assert.equal(initial.overworld.position.y, 2);
assert.ok(Array.isArray(initial.party.members));
assert.ok(initial.party.members.length >= 1);
assert.deepEqual(initial.battleOutcomes.keyBattles, {
  [KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED]: false,
  [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED]: false,
});
assert.deepEqual(initial.battleOutcomes.encounterResults, {});
assert.deepEqual(initial.questFlags, {});

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
assert.deepEqual(withBattleOutcome.battleOutcomes.encounterResults["level-1-training-ambush"], {
  result: "victory",
  recordedAt: "2026-03-10T00:00:00.000Z",
});
assert.equal(
  getBattleOutcomeFlag(withBattleOutcome, KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED),
  true
);

const withManualFlag = setBattleOutcomeFlag(
  withBattleOutcome,
  KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED,
  true
);
assert.equal(
  getBattleOutcomeFlag(withManualFlag, KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED),
  true
);

const withQuestFlag = setQuestFlag(withManualFlag, "quest.workshopGateUnlocked", true);
assert.equal(getQuestFlag(withQuestFlag, "quest.workshopGateUnlocked"), true);

const withQuestFlags = setQuestFlags(withQuestFlag, {
  "dialogue.rangerTutorialComplete": true,
  "quest.workshopGateUnlocked": true,
});
assert.equal(getQuestFlag(withQuestFlags, "dialogue.rangerTutorialComplete"), true);

const legacyNormalized = normalizePlayerProgressState({
  battleOutcomes: {
    "level-1-training-ambush": { result: "victory", recordedAt: "2026-03-09T05:00:00.000Z" },
  },
  questFlags: {
    "quest.alpha-complete": true,
    "quest.beta-complete": false,
  },
});
assert.equal(
  getBattleOutcomeFlag(legacyNormalized, KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED),
  true
);
assert.deepEqual(legacyNormalized.battleOutcomes.encounterResults["level-1-training-ambush"], {
  result: "victory",
  recordedAt: "2026-03-09T05:00:00.000Z",
});
assert.equal(legacyNormalized.questFlags["quest.alpha-complete"], true);
assert.equal(legacyNormalized.questFlags["quest.beta-complete"], false);

const serialized = serializePlayerProgress(withQuestFlags);
const hydrated = deserializePlayerProgress(serialized);
assert.deepEqual(hydrated, withQuestFlags);

console.log("Player progress state test passed.");
