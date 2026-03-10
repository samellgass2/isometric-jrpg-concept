import { cheetahUnit, elephantUnit, guardianDogUnit } from "./units/animalUnits.js";

function cloneUnitConfig(config) {
  return {
    ...config,
    movement: { ...(config.movement ?? {}) },
    attack: { ...(config.attack ?? {}) },
    stats: { ...(config.stats ?? {}) },
    abilities: Array.isArray(config.abilities) ? [...config.abilities] : [],
  };
}

export const encounterDefinitions = {
  "level-1-training-ambush": {
    id: "level-1-training-ambush",
    name: "Training Ambush",
    triggerDescription: "Step on the glowing ambush tile in Level 1.",
    victoryCondition: "defeat_all_enemies",
    friendlyUnits: [
      {
        id: "protagonist",
        name: "Protagonist",
        archetype: "hero",
        movement: { tilesPerTurn: 4 },
        attack: { range: 1, baseDamage: 22, canAttackOverObstacles: false },
        stats: { maxHp: 120, defense: 14 },
        abilities: [],
        spawn: { x: 2, y: 4 },
        color: 0x6aa9ff,
        currentHp: 64,
      },
      {
        ...cloneUnitConfig(guardianDogUnit),
        id: "guardian-dog",
        spawn: { x: 3, y: 5 },
        color: 0xc48e5a,
      },
    ],
    enemyUnits: [
      {
        id: "enemy-raider-1",
        name: "Raider Scout",
        archetype: "raider",
        movement: { tilesPerTurn: 3 },
        attack: { range: 1, baseDamage: 18, canAttackOverObstacles: false },
        stats: { maxHp: 80, defense: 6 },
        abilities: [],
        spawn: { x: 8, y: 4 },
        color: 0xb14747,
      },
    ],
  },
  "level-2-canyon-gauntlet": {
    id: "level-2-canyon-gauntlet",
    name: "Canyon Gauntlet",
    triggerDescription: "Interact with the cracked totem in Level 2.",
    victoryCondition: "defeat_all_enemies",
    friendlyUnits: [
      {
        id: "protagonist",
        name: "Protagonist",
        archetype: "hero",
        movement: { tilesPerTurn: 4 },
        attack: { range: 1, baseDamage: 22, canAttackOverObstacles: false },
        stats: { maxHp: 120, defense: 14 },
        abilities: [],
        spawn: { x: 2, y: 4 },
        color: 0x6aa9ff,
        currentHp: 84,
      },
      {
        ...cloneUnitConfig(elephantUnit),
        id: "elephant-bulwark",
        spawn: { x: 4, y: 3 },
        color: 0xb5b5b5,
      },
      {
        ...cloneUnitConfig(cheetahUnit),
        id: "cheetah-skirmisher",
        spawn: { x: 3, y: 6 },
        color: 0xe8c26e,
      },
    ],
    enemyUnits: [
      {
        id: "enemy-raider-alpha",
        name: "Raider Alpha",
        archetype: "raider",
        movement: { tilesPerTurn: 3 },
        attack: { range: 1, baseDamage: 20, canAttackOverObstacles: false },
        stats: { maxHp: 88, defense: 8 },
        abilities: [],
        spawn: { x: 8, y: 3 },
        color: 0xc45656,
      },
      {
        id: "enemy-raider-beta",
        name: "Raider Beta",
        archetype: "raider",
        movement: { tilesPerTurn: 3 },
        attack: { range: 1, baseDamage: 18, canAttackOverObstacles: false },
        stats: { maxHp: 78, defense: 7 },
        abilities: [],
        spawn: { x: 9, y: 5 },
        color: 0xb14747,
      },
    ],
  },
};

export function getEncounterDefinition(encounterId) {
  return encounterDefinitions[encounterId] ?? null;
}

export default encounterDefinitions;
