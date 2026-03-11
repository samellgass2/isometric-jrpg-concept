import {
  createCheetahCharacter,
  createControllerDroneCharacter,
  createDefenderDroneCharacter,
  createElephantCharacter,
  createGuardianDogCharacter,
  createScoutDogCharacter,
  createScoutDroneCharacter,
} from "../../models/characterModels.js";

const DEFAULT_DANGER_TRIGGER = {
  source: "protagonist",
  condition: "low_hp",
  thresholdPercent: 35,
  comparator: "lte",
};

export const AI_BEHAVIOR_TAGS = Object.freeze({
  AGGRESSIVE: "aggressive",
  DEFENSIVE: "defensive",
  SUPPORT: "support",
});

export const elephantUnit = Object.freeze(
  createElephantCharacter({
    abilities: [
      {
        id: "trampling-arc",
        name: "Trampling Arc",
        description: "Melee strike that can connect through cover and low walls.",
        type: "passive",
        trigger: {
          source: "self",
          condition: "on_attack",
        },
        effect: {
          modifies: "attack.ignoresObstaclePenalty",
          value: true,
        },
      },
    ],
    tags: ["animal", "frontline", "obstacle-breaker"],
  })
);

export const cheetahUnit = Object.freeze(
  createCheetahCharacter({
    abilities: [
      {
        id: "predator-sprint",
        name: "Predator Sprint",
        description: "Starts engagements quickly, but cannot hold ground for long.",
        type: "passive",
        trigger: {
          source: "self",
          condition: "on_turn_start",
        },
        effect: {
          modifies: "movement.initiativeBonus",
          value: 2,
        },
      },
    ],
    tags: ["animal", "mobile", "fragile"],
  })
);

export const guardianDogUnit = Object.freeze(
  createGuardianDogCharacter({
    abilities: [
      {
        id: "loyal-fury",
        name: "Loyal Fury",
        description:
          "When the protagonist is in danger, the dog enters a defensive combat frenzy.",
        type: "conditional_passive",
        trigger: DEFAULT_DANGER_TRIGGER,
        effect: {
          modifies: ["attack.baseDamage", "stats.defense"],
          operation: "multiply",
          value: {
            attackMultiplier: 1.5,
            defenseMultiplier: 1.35,
          },
          duration: "while_trigger_active",
        },
      },
    ],
    tags: ["animal", "support", "protagonist-linked"],
  })
);

export const scoutDogUnit = Object.freeze(
  createScoutDogCharacter({
    abilities: [
      {
        id: "pack-protect",
        name: "Pack Protect",
        description: "Sprints to the protagonist and gains damage while they are in danger.",
        type: "conditional_passive",
        trigger: DEFAULT_DANGER_TRIGGER,
        effect: {
          modifies: "attack.baseDamage",
          operation: "multiply",
          value: 1.45,
          duration: "while_trigger_active",
        },
      },
    ],
    tags: ["animal", "mobile", "protagonist-linked"],
  })
);

export const zookeeperScoutDroneUnit = Object.freeze(
  createScoutDroneCharacter({
    aiBehavior: AI_BEHAVIOR_TAGS.AGGRESSIVE,
    abilities: [
      {
        id: "target-ping",
        name: "Target Ping",
        description: "Scans for exposed targets and rushes weak flanks.",
        type: "passive",
        trigger: {
          source: "self",
          condition: "on_turn_start",
        },
        effect: {
          modifies: "movement.initiativeBonus",
          value: 1,
        },
      },
    ],
  })
);

export const zookeeperDefenderDroneUnit = Object.freeze(
  createDefenderDroneCharacter({
    aiBehavior: AI_BEHAVIOR_TAGS.DEFENSIVE,
    abilities: [
      {
        id: "guard-plating",
        name: "Guard Plating",
        description: "Reinforced chassis optimized for holding front lines.",
        type: "passive",
        trigger: {
          source: "self",
          condition: "on_turn_start",
        },
        effect: {
          modifies: "stats.damageReduction",
          value: 0.1,
        },
      },
    ],
  })
);

export const zookeeperControllerDroneUnit = Object.freeze(
  createControllerDroneCharacter({
    aiBehavior: AI_BEHAVIOR_TAGS.SUPPORT,
    abilities: [
      {
        id: "suppression-signal",
        name: "Suppression Signal",
        description: "Projects control pulses from range to pressure backline targets.",
        type: "passive",
        trigger: {
          source: "self",
          condition: "on_attack",
        },
        effect: {
          modifies: "attack.appliesPressure",
          value: true,
        },
      },
    ],
  })
);

export const animalUnits = {
  elephant: elephantUnit,
  cheetah: cheetahUnit,
  guardianDog: guardianDogUnit,
  scoutDog: scoutDogUnit,
};

export const animalUnitList = Object.freeze(Object.values(animalUnits));

export const zookeeperDroneUnits = Object.freeze({
  scoutDrone: zookeeperScoutDroneUnit,
  defenderDrone: zookeeperDefenderDroneUnit,
  controllerDrone: zookeeperControllerDroneUnit,
});

export const zookeeperDroneUnitList = Object.freeze(Object.values(zookeeperDroneUnits));

export function getZookeeperDroneUnitConfig(unitKey) {
  return zookeeperDroneUnits[unitKey] ?? null;
}

export function getAnimalUnitConfig(unitKey) {
  return animalUnits[unitKey] ?? null;
}

export default animalUnits;
