import assert from "node:assert/strict";
import {
  addInventoryItem,
  addPartyMember,
  adjustPartyMemberHealth,
  applyGameStateToPlayerProgress,
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
  questFlags: {
    "quest.workshopGateUnlocked": true,
  },
});

const fromProgress = createGameStateFromPlayerProgress(seedProgress);
assert.equal(fromProgress.party.members[0].name, "Pathfinder");
assert.equal(fromProgress.storyFlags["quest.workshopGateUnlocked"], true);

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

const exportedProgress = applyGameStateToPlayerProgress(getGameState(), createInitialPlayerProgressState());
assert.equal(exportedProgress.party.members.some((member) => member.id === "protagonist"), true);
assert.equal(exportedProgress.questFlags["quest.workshopGateUnlocked"], true);

console.log("Game state model test passed.");
