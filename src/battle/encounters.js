import {
  cheetahUnit,
  elephantUnit,
  guardianDogUnit,
  zookeeperControllerDroneUnit,
  zookeeperDefenderDroneUnit,
  zookeeperScoutDroneUnit,
} from "./units/animalUnits.js";
import { createProtagonistCharacter } from "../models/characterModels.js";

function cloneUnitConfig(config) {
  return {
    ...config,
    movement: { ...(config.movement ?? {}) },
    attack: { ...(config.attack ?? {}) },
    stats: { ...(config.stats ?? {}) },
    abilities: Array.isArray(config.abilities) ? [...config.abilities] : [],
    tags: Array.isArray(config.tags) ? [...config.tags] : [],
  };
}

function createProtagonistEncounterUnit(overrides = {}) {
  return {
    ...cloneUnitConfig(createProtagonistCharacter()),
    ...overrides,
  };
}

export const encounterDefinitions = {
  "overworld-first-drone": {
    id: "overworld-first-drone",
    name: "Perimeter Drone Sweep",
    triggerDescription: "Step into the shimmering patrol zone near Ranger Sol.",
    victoryCondition: "defeat_all_enemies",
    obstacles: [
      { x: 5, y: 3 },
      { x: 6, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 4 },
    ],
    friendlyUnits: [
      createProtagonistEncounterUnit({
        spawn: { x: 2, y: 4 },
        color: 0x6aa9ff,
        currentHp: 100,
      }),
      {
        ...cloneUnitConfig(guardianDogUnit),
        id: "guardian-dog",
        spawn: { x: 3, y: 5 },
        color: 0xc48e5a,
      },
    ],
    enemyUnits: [
      {
        ...cloneUnitConfig(zookeeperScoutDroneUnit),
        id: "enemy-overworld-scout-1",
        spawn: { x: 9, y: 4 },
        color: 0xe08989,
      },
      {
        ...cloneUnitConfig(zookeeperDefenderDroneUnit),
        id: "enemy-overworld-defender-1",
        spawn: { x: 10, y: 5 },
        color: 0xc06a6a,
      },
    ],
    rewards: {
      inventory: [{ itemId: "drone-scrap", amount: 1 }],
      storyFlags: {
        "quest.dronePerimeterSecured": true,
      },
    },
  },
  "drone-test-battle": {
    id: "drone-test-battle",
    name: "Drone Test Battle",
    triggerDescription: "Debug encounter for validating zookeeper drone AI behavior.",
    victoryCondition: "defeat_all_enemies",
    obstacles: [
      { x: 5, y: 2 },
      { x: 6, y: 2 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ],
    friendlyUnits: [
      createProtagonistEncounterUnit({
        spawn: { x: 2, y: 4 },
        color: 0x6aa9ff,
        currentHp: 120,
      }),
      {
        ...cloneUnitConfig(guardianDogUnit),
        id: "drone-test-guardian-dog",
        spawn: { x: 3, y: 5 },
        color: 0xc48e5a,
      },
    ],
    enemyUnits: [
      {
        ...cloneUnitConfig(zookeeperDefenderDroneUnit),
        id: "drone-test-defender-1",
        spawn: { x: 9, y: 6 },
        color: 0xc06a6a,
      },
      {
        ...cloneUnitConfig(zookeeperScoutDroneUnit),
        id: "drone-test-scout-1",
        spawn: { x: 9, y: 2 },
        color: 0xde8c8c,
      },
      {
        ...cloneUnitConfig(zookeeperControllerDroneUnit),
        id: "drone-test-controller-1",
        spawn: { x: 10, y: 4 },
        color: 0xa65f9a,
      },
    ],
  },
  "level-1-training-ambush": {
    id: "level-1-training-ambush",
    name: "Training Ambush",
    triggerDescription: "Step on the glowing ambush tile in Level 1.",
    victoryCondition: "defeat_all_enemies",
    friendlyUnits: [
      createProtagonistEncounterUnit({
        spawn: { x: 2, y: 4 },
        color: 0x6aa9ff,
        currentHp: 64,
      }),
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
      createProtagonistEncounterUnit({
        spawn: { x: 2, y: 4 },
        color: 0x6aa9ff,
        currentHp: 84,
      }),
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
        ...cloneUnitConfig(zookeeperDefenderDroneUnit),
        id: "enemy-zookeeper-defender-1",
        spawn: { x: 8, y: 3 },
        color: 0xc06a6a,
      },
      {
        ...cloneUnitConfig(zookeeperScoutDroneUnit),
        id: "enemy-zookeeper-scout-1",
        spawn: { x: 9, y: 5 },
        color: 0xde8c8c,
      },
      {
        ...cloneUnitConfig(zookeeperControllerDroneUnit),
        id: "enemy-zookeeper-controller-1",
        spawn: { x: 10, y: 2 },
        color: 0xa65f9a,
      },
    ],
  },
};

export function getEncounterDefinition(encounterId) {
  return encounterDefinitions[encounterId] ?? null;
}

export default encounterDefinitions;
