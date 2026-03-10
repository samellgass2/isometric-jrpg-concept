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
    stats,
    movement,
    attack,
    abilities,
    tags,
  };
}

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

export const animalUnits = {
  elephant: elephantUnit,
  cheetah: cheetahUnit,
  guardianDog: guardianDogUnit,
  scoutDog: scoutDogUnit,
};

export const animalUnitList = Object.freeze(Object.values(animalUnits));

export function getAnimalUnitConfig(unitKey) {
  return animalUnits[unitKey] ?? null;
}

export default animalUnits;
