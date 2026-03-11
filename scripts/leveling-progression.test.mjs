import assert from "node:assert/strict";
import { createProtagonistCharacter } from "../src/models/characterModels.js";
import { awardCharacterXP, getXpToNextLevel } from "../src/progression/leveling.js";
import { addPartyMember, awardPartyXP, getPartyMember, initGameState } from "../src/state/gameState.js";

const protagonist = createProtagonistCharacter({
  currentXP: 0,
  xpToNextLevel: getXpToNextLevel(1),
  currentStats: { hp: 120, maxHp: 120, attackPower: 22, defense: 14, speed: 4 },
  baseStats: { hp: 120, maxHp: 120, attackPower: 22, defense: 14, speed: 4 },
});

const levelTwoResult = awardCharacterXP(protagonist, 120);
assert.equal(levelTwoResult.character.level, 2, "Protagonist should reach level 2 from a single reward.");
assert.equal(levelTwoResult.levelsGained, 1);
assert.equal(levelTwoResult.character.currentStats.maxHp > protagonist.currentStats.maxHp, true);
assert.equal(levelTwoResult.character.currentStats.attackPower > protagonist.currentStats.attackPower, true);
assert.equal(levelTwoResult.character.currentStats.defense > protagonist.currentStats.defense, true);
assert.equal(levelTwoResult.character.currentStats.speed >= protagonist.currentStats.speed, true);

const multiLevelResult = awardCharacterXP(protagonist, 600);
assert.equal(multiLevelResult.character.level >= 4, true, "Large XP gain should process multiple level ups.");
assert.equal(multiLevelResult.levelsGained >= 3, true);
assert.equal(
  multiLevelResult.character.currentXP < multiLevelResult.character.xpToNextLevel,
  true,
  "Remaining XP should stay below the final level threshold."
);

initGameState({
  party: {
    members: [protagonist],
    memberOrder: ["protagonist"],
  },
});

addPartyMember({
  id: "guardian-dog",
  name: "Guardian Dog",
  archetype: "dog",
  level: 1,
  currentXP: 0,
  xpToNextLevel: getXpToNextLevel(1),
  currentStats: { hp: 130, maxHp: 130, attackPower: 26, defense: 12, speed: 5 },
  baseStats: { hp: 130, maxHp: 130, attackPower: 26, defense: 12, speed: 5 },
  movement: { tilesPerTurn: 5 },
  attack: { range: 1, baseDamage: 26, canAttackOverObstacles: false },
});

const awardSummary = awardPartyXP(["protagonist", "guardian-dog"], 240);
assert.equal(awardSummary.awards.length, 2);
assert.equal(getPartyMember("protagonist")?.level, 3);
assert.equal(getPartyMember("guardian-dog")?.level, 3);

console.log("Leveling progression test passed.");
