const DEFAULT_DANGER_TRIGGER = {
  source: "protagonist",
  condition: "low_hp",
  thresholdPercent: 35,
  comparator: "lte",
};

function createAnimalUnitConfig({
  id,
  name,
  role,
  archetype,
  aiBehavior = null,
  stats,
  movement,
  attack,
  abilities = [],
  tags = [],
}) {
  return {
    id,
    name,
    role,
    archetype,
    aiBehavior,
    stats,
    movement,
    attack,
    abilities,
    tags,
  };
}

export const AI_BEHAVIOR_TAGS = Object.freeze({
  AGGRESSIVE: "aggressive",
  DEFENSIVE: "defensive",
  SUPPORT: "support",
});

export const elephantUnit = createAnimalUnitConfig({
  id: "animal-elephant-bulwark",
  name: "Elephant Bulwark",
  role: "tank",
  archetype: "elephant",
  stats: {
    maxHp: 220,
    defense: 24,
  },
  movement: {
    tilesPerTurn: 2,
    speedClass: "slow",
  },
  attack: {
    range: 2,
    baseDamage: 38,
    canAttackOverObstacles: true,
  },
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
});

export const cheetahUnit = createAnimalUnitConfig({
  id: "animal-cheetah-skirmisher",
  name: "Cheetah Skirmisher",
  role: "flanker",
  archetype: "cheetah",
  stats: {
    maxHp: 95,
    defense: 6,
  },
  movement: {
    tilesPerTurn: 7,
    speedClass: "very_fast",
  },
  attack: {
    range: 1,
    baseDamage: 30,
    canAttackOverObstacles: false,
  },
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
});

export const guardianDogUnit = createAnimalUnitConfig({
  id: "animal-dog-guardian",
  name: "Guardian Dog",
  role: "protector",
  archetype: "dog",
  stats: {
    maxHp: 130,
    defense: 12,
  },
  movement: {
    tilesPerTurn: 5,
    speedClass: "fast",
  },
  attack: {
    range: 1,
    baseDamage: 26,
    canAttackOverObstacles: false,
  },
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
});

export const scoutDogUnit = createAnimalUnitConfig({
  id: "animal-dog-scout",
  name: "Scout Dog",
  role: "harrier",
  archetype: "dog",
  stats: {
    maxHp: 115,
    defense: 10,
  },
  movement: {
    tilesPerTurn: 6,
    speedClass: "fast",
  },
  attack: {
    range: 1,
    baseDamage: 22,
    canAttackOverObstacles: false,
  },
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
});

export const zookeeperScoutDroneUnit = createAnimalUnitConfig({
  id: "enemy-zookeeper-drone-scout",
  name: "Zookeeper Scout Drone",
  role: "skirmisher",
  archetype: "zookeeper-drone",
  aiBehavior: AI_BEHAVIOR_TAGS.AGGRESSIVE,
  stats: {
    maxHp: 72,
    defense: 5,
  },
  movement: {
    tilesPerTurn: 6,
    speedClass: "very_fast",
  },
  attack: {
    range: 2,
    baseDamage: 18,
    canAttackOverObstacles: false,
  },
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
  tags: ["enemy", "zookeeper", "drone", "scout"],
});

export const zookeeperDefenderDroneUnit = createAnimalUnitConfig({
  id: "enemy-zookeeper-drone-defender",
  name: "Zookeeper Defender Drone",
  role: "bulwark",
  archetype: "zookeeper-drone",
  aiBehavior: AI_BEHAVIOR_TAGS.DEFENSIVE,
  stats: {
    maxHp: 158,
    defense: 18,
  },
  movement: {
    tilesPerTurn: 3,
    speedClass: "slow",
  },
  attack: {
    range: 1,
    baseDamage: 24,
    canAttackOverObstacles: false,
  },
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
  tags: ["enemy", "zookeeper", "drone", "defender"],
});

export const zookeeperControllerDroneUnit = createAnimalUnitConfig({
  id: "enemy-zookeeper-drone-controller",
  name: "Zookeeper Controller Drone",
  role: "controller",
  archetype: "zookeeper-drone",
  aiBehavior: AI_BEHAVIOR_TAGS.SUPPORT,
  stats: {
    maxHp: 96,
    defense: 8,
  },
  movement: {
    tilesPerTurn: 4,
    speedClass: "medium",
  },
  attack: {
    range: 3,
    baseDamage: 14,
    canAttackOverObstacles: true,
  },
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
  tags: ["enemy", "zookeeper", "drone", "controller"],
});

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
