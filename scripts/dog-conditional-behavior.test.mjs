import assert from "node:assert/strict";
import {
  cheetahUnit,
  elephantUnit,
  guardianDogUnit,
  scoutDogUnit,
} from "../src/battle/units/animalUnits.js";
import {
  getEffectiveCombatStats,
  isDogDangerBuffActive,
  resolveAttack,
} from "../src/battle/combatResolver.js";
import { chooseAllyAction } from "../src/battle/ai/allyDecisionController.js";

function createBattleUnit(unitConfig, overrides = {}) {
  return {
    ...unitConfig,
    currentHp: unitConfig.stats.maxHp,
    ...overrides,
  };
}

const protagonistSafe = {
  id: "hero-1",
  name: "Protagonist",
  currentHp: 90,
  stats: { maxHp: 100, defense: 8 },
};

const protagonistInDanger = {
  id: "hero-1",
  name: "Protagonist",
  currentHp: 25,
  stats: { maxHp: 100, defense: 8 },
};

const guardianDog = createBattleUnit(guardianDogUnit);
const scoutDog = createBattleUnit(scoutDogUnit);
const elephant = createBattleUnit(elephantUnit);
const cheetah = createBattleUnit(cheetahUnit);
const enemy = {
  id: "enemy-raider",
  name: "Raider",
  stats: {
    maxHp: 100,
    defense: 8,
  },
  attack: {
    baseDamage: 15,
  },
  currentHp: 46,
};
const highThreatEnemy = {
  id: "enemy-brute",
  name: "Brute",
  stats: {
    maxHp: 140,
    defense: 10,
  },
  attack: {
    baseDamage: 30,
  },
  currentHp: 50,
};

// Safe protagonist: dogs keep baseline numbers.
assert.equal(isDogDangerBuffActive(guardianDog, protagonistSafe), false);
const guardianStatsSafe = getEffectiveCombatStats(guardianDog, { protagonist: protagonistSafe });
assert.equal(guardianStatsSafe.damage, guardianDog.attack.baseDamage);
assert.equal(guardianStatsSafe.defense, guardianDog.stats.defense);
assert.equal(guardianStatsSafe.buffActive, false);

// Danger protagonist: dogs gain observable boost.
assert.equal(isDogDangerBuffActive(guardianDog, protagonistInDanger), true);
const guardianStatsDanger = getEffectiveCombatStats(guardianDog, {
  protagonist: protagonistInDanger,
});
assert.ok(guardianStatsDanger.damage > guardianDog.attack.baseDamage);
assert.ok(guardianStatsDanger.defense > guardianDog.stats.defense);
assert.equal(guardianStatsDanger.buffActive, true);

const scoutStatsDanger = getEffectiveCombatStats(scoutDog, { protagonist: protagonistInDanger });
assert.ok(scoutStatsDanger.damage > scoutDog.attack.baseDamage);
assert.equal(scoutStatsDanger.defense, scoutDog.stats.defense);

// Combat resolution reflects the buff.
const safeAttackResult = resolveAttack({
  attacker: guardianDog,
  defender: enemy,
  protagonist: protagonistSafe,
});
const dangerAttackResult = resolveAttack({
  attacker: guardianDog,
  defender: enemy,
  protagonist: protagonistInDanger,
});
assert.ok(dangerAttackResult.damage > safeAttackResult.damage);
assert.equal(safeAttackResult.attackerStats.buffActive, false);
assert.equal(dangerAttackResult.attackerStats.buffActive, true);

// Crossing back above threshold removes the buff immediately.
const protagonistRecovered = {
  ...protagonistInDanger,
  currentHp: 60,
};
const recoveredStats = getEffectiveCombatStats(guardianDog, {
  protagonist: protagonistRecovered,
});
assert.equal(recoveredStats.buffActive, false);
assert.equal(recoveredStats.damage, guardianDog.attack.baseDamage);
assert.equal(recoveredStats.defense, guardianDog.stats.defense);

// Non-dog units remain unaffected in same danger state.
const elephantStatsDanger = getEffectiveCombatStats(elephant, { protagonist: protagonistInDanger });
const cheetahStatsDanger = getEffectiveCombatStats(cheetah, { protagonist: protagonistInDanger });
assert.equal(elephantStatsDanger.buffActive, false);
assert.equal(cheetahStatsDanger.buffActive, false);
assert.equal(elephantStatsDanger.damage, elephant.attack.baseDamage);
assert.equal(cheetahStatsDanger.damage, cheetah.attack.baseDamage);

// AI behavior: buffed dogs should prefer aggressive actions.
const aiActionSafe = chooseAllyAction({
  unit: guardianDog,
  enemies: [enemy, highThreatEnemy],
  protagonist: protagonistSafe,
});
const aiActionDanger = chooseAllyAction({
  unit: guardianDog,
  enemies: [enemy, highThreatEnemy],
  protagonist: protagonistInDanger,
});
assert.equal(aiActionSafe.stance, "standard");
assert.equal(aiActionSafe.targetId, enemy.id);
assert.equal(aiActionDanger.stance, "aggressive");
assert.equal(aiActionDanger.action, "attack");
assert.equal(aiActionDanger.targetId, highThreatEnemy.id);

// Protagonist crossing threshold should never throw.
assert.doesNotThrow(() => {
  resolveAttack({
    attacker: guardianDog,
    defender: enemy,
    protagonist: protagonistSafe,
  });
  resolveAttack({
    attacker: guardianDog,
    defender: enemy,
    protagonist: protagonistInDanger,
  });
  resolveAttack({
    attacker: guardianDog,
    defender: enemy,
    protagonist: protagonistRecovered,
  });
});

console.log("Dog conditional behavior test passed.");
