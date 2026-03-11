function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeId(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function sanitizeStats(stats, fallback = {}) {
  const source = isPlainObject(stats) ? stats : {};
  const defaults = isPlainObject(fallback) ? fallback : {};

  const maxHp = Math.max(1, toInteger(source.maxHp, toInteger(defaults.maxHp, 100)));
  const hpFallback = Number.isFinite(defaults.hp) ? defaults.hp : maxHp;
  const hp = Math.max(0, Math.min(maxHp, toInteger(source.hp, hpFallback)));
  const defense = Math.max(0, toInteger(source.defense, toInteger(defaults.defense, 0)));
  const attackPower = Math.max(0, toInteger(source.attackPower, toInteger(defaults.attackPower, 0)));
  const speed = Math.max(0, toInteger(source.speed, toInteger(defaults.speed, 0)));

  return {
    maxHp,
    hp,
    defense,
    attackPower,
    speed,
  };
}

function syncLegacyStatFields(character) {
  return {
    ...character,
    currentHp: character.currentStats.hp,
    maxHp: character.currentStats.maxHp,
    stats: {
      ...(isPlainObject(character.stats) ? character.stats : {}),
      hp: character.currentStats.hp,
      maxHp: character.currentStats.maxHp,
      defense: character.currentStats.defense,
    },
  };
}

export function normalizeCharacterModel(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const id = normalizeId(candidate.id);
  if (!id) {
    return null;
  }

  const baseStatsSeed = {
    maxHp: candidate.baseStats?.maxHp ?? candidate.maxHp ?? candidate.stats?.maxHp,
    hp: candidate.baseStats?.hp ?? candidate.maxHp ?? candidate.stats?.maxHp,
    defense: candidate.baseStats?.defense ?? candidate.stats?.defense,
    attackPower: candidate.baseStats?.attackPower ?? candidate.attack?.baseDamage,
    speed: candidate.baseStats?.speed ?? candidate.movement?.tilesPerTurn,
  };
  const baseStats = sanitizeStats(candidate.baseStats, baseStatsSeed);

  const currentStatsSeed = {
    maxHp: candidate.currentStats?.maxHp ?? candidate.maxHp ?? candidate.stats?.maxHp ?? baseStats.maxHp,
    hp:
      candidate.currentStats?.hp ?? candidate.currentHp ?? candidate.stats?.hp ?? candidate.maxHp ?? baseStats.maxHp,
    defense: candidate.currentStats?.defense ?? candidate.stats?.defense ?? baseStats.defense,
    attackPower: candidate.currentStats?.attackPower ?? candidate.attack?.baseDamage ?? baseStats.attackPower,
    speed: candidate.currentStats?.speed ?? candidate.movement?.tilesPerTurn ?? baseStats.speed,
  };
  const currentStats = sanitizeStats(candidate.currentStats, currentStatsSeed);

  const next = {
    id,
    name: normalizeId(candidate.name) || id,
    archetype: normalizeId(candidate.archetype) || null,
    role: normalizeId(candidate.role) || null,
    aiBehavior: normalizeId(candidate.aiBehavior) || null,
    level: Math.max(1, toInteger(candidate.level, 1)),
    currentXP: Math.max(0, toInteger(candidate.currentXP, 0)),
    xpToNextLevel: Math.max(1, toInteger(candidate.xpToNextLevel, 100)),
    baseStats,
    currentStats,
    movement: isPlainObject(candidate.movement) ? { ...candidate.movement } : {},
    attack: isPlainObject(candidate.attack) ? { ...candidate.attack } : {},
    abilities: Array.isArray(candidate.abilities) ? candidate.abilities.map((ability) => cloneJson(ability)) : [],
    tags: Array.isArray(candidate.tags) ? [...candidate.tags] : [],
    flags: {
      isDrone:
        candidate.flags?.isDrone === true ||
        candidate.isDrone === true ||
        normalizeId(candidate.archetype).includes("drone"),
      isProtagonist:
        candidate.flags?.isProtagonist === true || candidate.isProtagonist === true || id === "protagonist",
      isPartyMember:
        candidate.flags?.isPartyMember === true ||
        candidate.isPartyMember === true ||
        normalizeId(candidate.faction) === "friendly" ||
        id === "protagonist",
    },
  };

  return syncLegacyStatFields(next);
}

function createCharacterFromTemplate(template, overrides = {}) {
  return normalizeCharacterModel({
    ...cloneJson(template),
    ...cloneJson(overrides),
    baseStats: {
      ...(template.baseStats ?? {}),
      ...(overrides.baseStats ?? {}),
    },
    currentStats: {
      ...(template.currentStats ?? {}),
      ...(overrides.currentStats ?? {}),
    },
    movement: {
      ...(template.movement ?? {}),
      ...(overrides.movement ?? {}),
    },
    attack: {
      ...(template.attack ?? {}),
      ...(overrides.attack ?? {}),
    },
    flags: {
      ...(template.flags ?? {}),
      ...(overrides.flags ?? {}),
    },
    abilities: Array.isArray(overrides.abilities)
      ? overrides.abilities.map((ability) => cloneJson(ability))
      : cloneJson(template.abilities ?? []),
    tags: Array.isArray(overrides.tags) ? [...overrides.tags] : [...(template.tags ?? [])],
  });
}

const CHARACTER_TEMPLATES = Object.freeze({
  protagonist: {
    id: "protagonist",
    name: "Protagonist",
    archetype: "hero",
    role: "leader",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 120, hp: 120, defense: 14, attackPower: 22, speed: 4 },
    currentStats: { maxHp: 120, hp: 100, defense: 14, attackPower: 22, speed: 4 },
    movement: { tilesPerTurn: 4 },
    attack: { range: 1, baseDamage: 22, canAttackOverObstacles: false },
    abilities: [],
    tags: ["hero", "party"],
    flags: { isDrone: false, isProtagonist: true, isPartyMember: true },
  },
  elephant: {
    id: "elephant-bulwark",
    name: "Elephant Bulwark",
    archetype: "elephant",
    role: "tank",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 220, hp: 220, defense: 24, attackPower: 38, speed: 2 },
    currentStats: { maxHp: 220, hp: 220, defense: 24, attackPower: 38, speed: 2 },
    movement: { tilesPerTurn: 2, speedClass: "slow" },
    attack: { range: 2, baseDamage: 38, canAttackOverObstacles: true },
    abilities: [],
    tags: ["animal", "frontline"],
    flags: { isDrone: false, isProtagonist: false, isPartyMember: true },
  },
  cheetah: {
    id: "cheetah-skirmisher",
    name: "Cheetah Skirmisher",
    archetype: "cheetah",
    role: "flanker",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 95, hp: 95, defense: 6, attackPower: 30, speed: 7 },
    currentStats: { maxHp: 95, hp: 95, defense: 6, attackPower: 30, speed: 7 },
    movement: { tilesPerTurn: 7, speedClass: "very_fast" },
    attack: { range: 1, baseDamage: 30, canAttackOverObstacles: false },
    abilities: [],
    tags: ["animal", "mobile"],
    flags: { isDrone: false, isProtagonist: false, isPartyMember: true },
  },
  guardianDog: {
    id: "guardian-dog",
    name: "Guardian Dog",
    archetype: "dog",
    role: "protector",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 130, hp: 130, defense: 12, attackPower: 26, speed: 5 },
    currentStats: { maxHp: 130, hp: 130, defense: 12, attackPower: 26, speed: 5 },
    movement: { tilesPerTurn: 5, speedClass: "fast" },
    attack: { range: 1, baseDamage: 26, canAttackOverObstacles: false },
    abilities: [],
    tags: ["animal", "support"],
    flags: { isDrone: false, isProtagonist: false, isPartyMember: true },
  },
  scoutDog: {
    id: "scout-dog",
    name: "Scout Dog",
    archetype: "dog",
    role: "harrier",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 115, hp: 115, defense: 10, attackPower: 22, speed: 6 },
    currentStats: { maxHp: 115, hp: 115, defense: 10, attackPower: 22, speed: 6 },
    movement: { tilesPerTurn: 6, speedClass: "fast" },
    attack: { range: 1, baseDamage: 22, canAttackOverObstacles: false },
    abilities: [],
    tags: ["animal", "mobile"],
    flags: { isDrone: false, isProtagonist: false, isPartyMember: true },
  },
  scoutDrone: {
    id: "enemy-zookeeper-drone-scout",
    name: "Zookeeper Scout Drone",
    archetype: "zookeeper-drone",
    role: "skirmisher",
    aiBehavior: "aggressive",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 72, hp: 72, defense: 5, attackPower: 18, speed: 6 },
    currentStats: { maxHp: 72, hp: 72, defense: 5, attackPower: 18, speed: 6 },
    movement: { tilesPerTurn: 6, speedClass: "very_fast" },
    attack: { range: 2, baseDamage: 18, canAttackOverObstacles: false },
    abilities: [],
    tags: ["enemy", "zookeeper", "drone", "scout"],
    flags: { isDrone: true, isProtagonist: false, isPartyMember: false },
  },
  defenderDrone: {
    id: "enemy-zookeeper-drone-defender",
    name: "Zookeeper Defender Drone",
    archetype: "zookeeper-drone",
    role: "bulwark",
    aiBehavior: "defensive",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 158, hp: 158, defense: 18, attackPower: 24, speed: 3 },
    currentStats: { maxHp: 158, hp: 158, defense: 18, attackPower: 24, speed: 3 },
    movement: { tilesPerTurn: 3, speedClass: "slow" },
    attack: { range: 1, baseDamage: 24, canAttackOverObstacles: false },
    abilities: [],
    tags: ["enemy", "zookeeper", "drone", "defender"],
    flags: { isDrone: true, isProtagonist: false, isPartyMember: false },
  },
  controllerDrone: {
    id: "enemy-zookeeper-drone-controller",
    name: "Zookeeper Controller Drone",
    archetype: "zookeeper-drone",
    role: "controller",
    aiBehavior: "support",
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    baseStats: { maxHp: 96, hp: 96, defense: 8, attackPower: 14, speed: 4 },
    currentStats: { maxHp: 96, hp: 96, defense: 8, attackPower: 14, speed: 4 },
    movement: { tilesPerTurn: 4, speedClass: "medium" },
    attack: { range: 3, baseDamage: 14, canAttackOverObstacles: true },
    abilities: [],
    tags: ["enemy", "zookeeper", "drone", "controller"],
    flags: { isDrone: true, isProtagonist: false, isPartyMember: false },
  },
});

export function createProtagonistCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.protagonist, overrides);
}

export function createElephantCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.elephant, overrides);
}

export function createCheetahCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.cheetah, overrides);
}

export function createGuardianDogCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.guardianDog, overrides);
}

export function createScoutDogCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.scoutDog, overrides);
}

export function createScoutDroneCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.scoutDrone, overrides);
}

export function createDefenderDroneCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.defenderDrone, overrides);
}

export function createControllerDroneCharacter(overrides = {}) {
  return createCharacterFromTemplate(CHARACTER_TEMPLATES.controllerDrone, overrides);
}

export function normalizeCharacterCollection(characters) {
  if (!Array.isArray(characters)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  characters.forEach((candidate) => {
    const character = normalizeCharacterModel(candidate);
    if (!character || seen.has(character.id)) {
      return;
    }
    seen.add(character.id);
    normalized.push(character);
  });

  return normalized;
}

export function serializeCharacterForPartyState(character) {
  const normalized = normalizeCharacterModel(character);
  if (!normalized) {
    return null;
  }

  return {
    id: normalized.id,
    name: normalized.name,
    archetype: normalized.archetype,
    level: normalized.level,
    currentXP: normalized.currentXP,
    xpToNextLevel: normalized.xpToNextLevel,
    baseStats: cloneJson(normalized.baseStats),
    currentStats: cloneJson(normalized.currentStats),
    abilities: cloneJson(normalized.abilities),
    flags: cloneJson(normalized.flags),
    currentHp: normalized.currentHp,
    maxHp: normalized.maxHp,
  };
}
