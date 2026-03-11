import assert from "node:assert/strict";
import {
  addInventoryItem,
  addPartyMember,
  adjustPartyMemberHealth,
  applyGameStateToPlayerProgress,
  awardPartyMemberXP,
  buildBattlePartyFromEncounterTemplates,
  createGameStateFromPlayerProgress,
  getGameState,
  getInventoryCount,
  getPartyMember,
  getStoryFlag,
  hasStoryFlag,
  initGameState,
  removeInventoryItem,
  removePartyMember,
  setPartyMemberHealth,
  setStoryFlag,
  setStoryFlags,
  subscribeToGameState,
} from "../src/state/gameState.js";
import {
  createInitialPlayerProgressState,
  normalizePlayerProgressState,
} from "../src/state/playerProgress.js";

const seedProgress = normalizePlayerProgressState({
  party: {
    members: [
      {
        id: "protagonist",
        name: "Pathfinder",
        archetype: "hero",
        level: 3,
        currentHp: 72,
        maxHp: 80,
      },
    ],
  },
  inventory: {
    items: {
      "workshop-pass": 1,
    },
  },
  questFlags: {
    "quest.workshopGateUnlocked": true,
  },
});

const fromProgress = createGameStateFromPlayerProgress(seedProgress);
assert.equal(fromProgress.party.members[0].name, "Pathfinder");
assert.equal(fromProgress.storyFlags["quest.workshopGateUnlocked"], true);
assert.equal(fromProgress.inventory.items["workshop-pass"], 1);

const initial = initGameState(fromProgress);
assert.equal(initial.party.members.length, 1);
assert.equal(getPartyMember("protagonist")?.currentHp, 72);

let publishCount = 0;
const unsubscribe = subscribeToGameState(() => {
  publishCount += 1;
});

addPartyMember({
  id: "guardian-dog",
  name: "Guardian Dog",
  archetype: "dog",
  level: 2,
  currentHp: 64,
  maxHp: 90,
});
assert.equal(getPartyMember("guardian-dog")?.maxHp, 90);

adjustPartyMemberHealth("guardian-dog", -20);
assert.equal(getPartyMember("guardian-dog")?.currentHp, 44);

setPartyMemberHealth("guardian-dog", { currentHp: 90, maxHp: 95 });
assert.equal(getPartyMember("guardian-dog")?.currentHp, 90);
assert.equal(getPartyMember("guardian-dog")?.maxHp, 95);

addInventoryItem("potion", 3);
addInventoryItem("potion", 2);
removeInventoryItem("potion", 4);
assert.equal(getInventoryCount("potion"), 1);

setStoryFlag("dialogue.rangerTutorialComplete", true);
setStoryFlags({
  "quest.workshopGateUnlocked": true,
  "battle.level1Cleared": "victory",
});
assert.equal(getStoryFlag("dialogue.rangerTutorialComplete"), true);
assert.equal(hasStoryFlag("quest.workshopGateUnlocked"), true);
assert.equal(getStoryFlag("battle.level1Cleared"), "victory");

removePartyMember("guardian-dog");
assert.equal(getPartyMember("guardian-dog"), null);

unsubscribe();
assert.ok(publishCount >= 6);

const encounterRoster = buildBattlePartyFromEncounterTemplates([
  {
    id: "protagonist",
    name: "Pathfinder",
    archetype: "hero",
    level: 4,
    currentHP: 60,
    currentHp: 60,
    maxHp: 100,
    stats: { maxHp: 100, defense: 12 },
    movement: { tilesPerTurn: 5 },
    attack: { range: 1, baseDamage: 28 },
    spawn: { x: 2, y: 4 },
  },
  {
    id: "elephant-bulwark",
    name: "Elephant Bulwark",
    archetype: "elephant",
    level: 1,
    currentHp: 220,
    maxHp: 220,
    stats: { maxHp: 220, defense: 24 },
    movement: { tilesPerTurn: 2 },
    attack: { range: 2, baseDamage: 38 },
    spawn: { x: 4, y: 3 },
  },
  {
    id: "battle-helper-drone",
    name: "Battle Helper Drone",
    archetype: "zookeeper-drone",
    level: 1,
    currentHp: 70,
    maxHp: 70,
    stats: { maxHp: 70, defense: 4 },
    movement: { tilesPerTurn: 5 },
    attack: { range: 2, baseDamage: 16 },
    flags: { isDrone: true, isPartyMember: true },
    spawn: { x: 5, y: 3 },
  },
]);
assert.deepEqual(
  encounterRoster.map((unit) => unit.id),
  ["protagonist", "elephant-bulwark", "battle-helper-drone"]
);
assert.equal(getPartyMember("elephant-bulwark")?.flags?.isDrone, false);
assert.equal(getPartyMember("battle-helper-drone"), null);

addPartyMember({
  id: "test-drone-party-member",
  name: "Test Drone",
  archetype: "zookeeper-drone",
  level: 1,
  currentXP: 0,
  xpToNextLevel: 100,
  currentHp: 40,
  maxHp: 40,
  flags: { isDrone: true, isPartyMember: true },
});
const droneBeforeXP = getPartyMember("test-drone-party-member");
awardPartyMemberXP("test-drone-party-member", 200);
const droneAfterXP = getPartyMember("test-drone-party-member");
assert.equal(droneAfterXP?.level, droneBeforeXP?.level);
assert.equal(droneAfterXP?.currentXP, droneBeforeXP?.currentXP);

const exportedProgress = applyGameStateToPlayerProgress(getGameState(), createInitialPlayerProgressState());
assert.equal(exportedProgress.party.members.some((member) => member.id === "protagonist"), true);
assert.equal(exportedProgress.questFlags["quest.workshopGateUnlocked"], true);
assert.equal(exportedProgress.inventory.items["workshop-pass"], 1);

console.log("Game state model test passed.");
