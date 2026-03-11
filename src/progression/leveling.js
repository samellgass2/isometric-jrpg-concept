import { normalizeCharacterModel } from "../models/characterModels.js";

const MAX_LEVEL = 50;
const XP_BASE_REQUIREMENT = 100;
const XP_REQUIREMENT_STEP = 40;

const ARCHETYPE_GROWTH_PROFILES = Object.freeze({
  hero: Object.freeze({ maxHp: 18, attackPower: 5, defense: 3, speed: 1 }),
  elephant: Object.freeze({ maxHp: 28, attackPower: 4, defense: 4, speed: 0 }),
  cheetah: Object.freeze({ maxHp: 12, attackPower: 6, defense: 2, speed: 2 }),
  dog: Object.freeze({ maxHp: 14, attackPower: 4, defense: 3, speed: 1 }),
  raider: Object.freeze({ maxHp: 16, attackPower: 4, defense: 2, speed: 1 }),
  "zookeeper-drone": Object.freeze({ maxHp: 10, attackPower: 3, defense: 2, speed: 1 }),
  default: Object.freeze({ maxHp: 14, attackPower: 4, defense: 2, speed: 1 }),
});

function toInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.floor(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getMaxLevel() {
  return MAX_LEVEL;
}

export function getGrowthProfileForArchetype(archetype) {
  const key = typeof archetype === "string" ? archetype.trim() : "";
  return ARCHETYPE_GROWTH_PROFILES[key] ?? ARCHETYPE_GROWTH_PROFILES.default;
}

export function getXpToNextLevel(level) {
  const normalizedLevel = Math.max(1, toInteger(level, 1));
  return XP_BASE_REQUIREMENT + (normalizedLevel - 1) * XP_REQUIREMENT_STEP;
}

export function applyLevelStatGrowth(character, options = {}) {
  const normalized = normalizeCharacterModel(character);
  if (!normalized) {
    return null;
  }

  const growth = options.growthProfile ?? getGrowthProfileForArchetype(normalized.archetype);
  const hpGrowth = Math.max(1, toInteger(growth.maxHp, 12));
  const attackGrowth = Math.max(0, toInteger(growth.attackPower, 3));
  const defenseGrowth = Math.max(0, toInteger(growth.defense, 2));
  const speedGrowth = Math.max(0, toInteger(growth.speed, 1));

  const currentStats = normalized.currentStats ?? {};
  const baseStats = normalized.baseStats ?? {};
  const hpBefore = clamp(toInteger(currentStats.hp, baseStats.maxHp), 0, Math.max(1, toInteger(baseStats.maxHp, 1)));

  const nextBaseMaxHp = Math.max(1, toInteger(baseStats.maxHp, 1) + hpGrowth);
  const nextBaseAttackPower = Math.max(0, toInteger(baseStats.attackPower, 0) + attackGrowth);
  const nextBaseDefense = Math.max(0, toInteger(baseStats.defense, 0) + defenseGrowth);
  const nextBaseSpeed = Math.max(0, toInteger(baseStats.speed, 0) + speedGrowth);

  const nextCurrentMaxHp = Math.max(1, toInteger(currentStats.maxHp, toInteger(baseStats.maxHp, 1)) + hpGrowth);
  const nextCurrentAttackPower = Math.max(0, toInteger(currentStats.attackPower, toInteger(baseStats.attackPower, 0)) + attackGrowth);
  const nextCurrentDefense = Math.max(0, toInteger(currentStats.defense, toInteger(baseStats.defense, 0)) + defenseGrowth);
  const nextCurrentSpeed = Math.max(0, toInteger(currentStats.speed, toInteger(baseStats.speed, 0)) + speedGrowth);

  const nextHp = clamp(hpBefore + hpGrowth, 0, nextCurrentMaxHp);

  return normalizeCharacterModel({
    ...normalized,
    baseStats: {
      ...baseStats,
      maxHp: nextBaseMaxHp,
      hp: nextBaseMaxHp,
      attackPower: nextBaseAttackPower,
      defense: nextBaseDefense,
      speed: nextBaseSpeed,
    },
    currentStats: {
      ...currentStats,
      maxHp: nextCurrentMaxHp,
      hp: nextHp,
      attackPower: nextCurrentAttackPower,
      defense: nextCurrentDefense,
      speed: nextCurrentSpeed,
    },
    attack: {
      ...(normalized.attack ?? {}),
      baseDamage: nextCurrentAttackPower,
    },
    movement: {
      ...(normalized.movement ?? {}),
      tilesPerTurn: Math.max(1, nextCurrentSpeed),
    },
  });
}

export function awardCharacterXP(character, xpAmount) {
  const normalized = normalizeCharacterModel(character);
  const awardedXP = Math.max(0, toInteger(xpAmount, 0));

  if (!normalized) {
    return {
      character: null,
      awardedXP,
      levelsGained: 0,
      levelUps: [],
      totalXP: 0,
    };
  }

  if (awardedXP === 0) {
    const currentRequirement = getXpToNextLevel(normalized.level);
    const preservedXP = clamp(normalized.currentXP, 0, currentRequirement - 1);
    const nextCharacter = normalizeCharacterModel({
      ...normalized,
      currentXP: preservedXP,
      xpToNextLevel: currentRequirement,
    });

    return {
      character: nextCharacter,
      awardedXP: 0,
      levelsGained: 0,
      levelUps: [],
      totalXP: preservedXP,
    };
  }

  let nextCharacter = normalizeCharacterModel({
    ...normalized,
    xpToNextLevel: getXpToNextLevel(normalized.level),
  });
  let xpPool = Math.max(0, toInteger(nextCharacter.currentXP, 0)) + awardedXP;
  const levelUps = [];

  while (nextCharacter.level < MAX_LEVEL) {
    const requirement = getXpToNextLevel(nextCharacter.level);
    if (xpPool < requirement) {
      break;
    }

    xpPool -= requirement;
    const beforeLevel = nextCharacter.level;
    const grown = applyLevelStatGrowth({
      ...nextCharacter,
      level: beforeLevel + 1,
      currentXP: 0,
      xpToNextLevel: getXpToNextLevel(beforeLevel + 1),
    });

    if (!grown) {
      break;
    }

    nextCharacter = grown;
    levelUps.push({
      fromLevel: beforeLevel,
      toLevel: nextCharacter.level,
      maxHp: nextCharacter.maxHp,
      attackPower: nextCharacter.currentStats.attackPower,
      defense: nextCharacter.currentStats.defense,
      speed: nextCharacter.currentStats.speed,
    });
  }

  const requirementForFinalLevel = getXpToNextLevel(nextCharacter.level);
  const boundedXP = nextCharacter.level >= MAX_LEVEL ? 0 : clamp(xpPool, 0, requirementForFinalLevel - 1);
  nextCharacter = normalizeCharacterModel({
    ...nextCharacter,
    currentXP: boundedXP,
    xpToNextLevel: requirementForFinalLevel,
  });

  return {
    character: nextCharacter,
    awardedXP,
    levelsGained: levelUps.length,
    levelUps,
    totalXP: boundedXP,
  };
}

export default {
  applyLevelStatGrowth,
  awardCharacterXP,
  getGrowthProfileForArchetype,
  getMaxLevel,
  getXpToNextLevel,
};
