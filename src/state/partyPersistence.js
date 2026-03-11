import { PLAYER_PROGRESS_STORAGE_KEY } from "../persistence/saveSystem.js";
import {
  normalizeCharacterModel,
  serializeCharacterForPartyState,
} from "../models/characterModels.js";
import {
  normalizePlayerProgressState,
  removePartyMember,
  upsertPartyMember,
} from "./playerProgress.js";

function cloneUnitConfig(unit) {
  return {
    ...unit,
    baseStats: { ...(unit.baseStats ?? {}) },
    currentStats: { ...(unit.currentStats ?? {}) },
    movement: { ...(unit.movement ?? {}) },
    attack: { ...(unit.attack ?? {}) },
    stats: { ...(unit.stats ?? {}) },
    abilities: Array.isArray(unit.abilities) ? [...unit.abilities] : [],
    tags: Array.isArray(unit.tags) ? [...unit.tags] : [],
    flags: { ...(unit.flags ?? {}) },
    spawn: unit.spawn ? { ...unit.spawn } : undefined,
  };
}

export function hasPersistedProgressData(storage = null) {
  const activeStorage = storage ?? globalThis?.localStorage ?? globalThis?.window?.localStorage ?? null;
  if (!activeStorage) {
    return false;
  }

  try {
    return typeof activeStorage.getItem(PLAYER_PROGRESS_STORAGE_KEY) === "string";
  } catch (_error) {
    return false;
  }
}

export function mergePersistedPartyMemberIntoUnit(unitConfig, persistedMember) {
  const baseUnit = cloneUnitConfig(unitConfig);
  if (!persistedMember) {
    return baseUnit;
  }

  const merged = normalizeCharacterModel({
    ...baseUnit,
    name: persistedMember.name || baseUnit.name,
    archetype: persistedMember.archetype ?? baseUnit.archetype,
    level: persistedMember.level ?? baseUnit.level,
    currentXP: persistedMember.currentXP ?? baseUnit.currentXP ?? 0,
    xpToNextLevel: persistedMember.xpToNextLevel ?? baseUnit.xpToNextLevel ?? 100,
    currentHp: persistedMember.currentHp,
    baseStats: persistedMember.baseStats ?? baseUnit.baseStats,
    currentStats: persistedMember.currentStats ?? baseUnit.currentStats,
    stats: {
      ...baseUnit.stats,
      maxHp: persistedMember.maxHp,
    },
    flags: {
      ...(baseUnit.flags ?? {}),
      ...(persistedMember.flags ?? {}),
      isPartyMember: true,
    },
  });

  return merged ? { ...baseUnit, ...merged } : baseUnit;
}

export function resolveInitialFriendlyUnits(friendlyUnits, progressState, options = {}) {
  if (!Array.isArray(friendlyUnits)) {
    return [];
  }

  const hasPersistedData = options.hasPersistedData === true;
  if (!hasPersistedData) {
    return friendlyUnits.map((unit) => cloneUnitConfig(unit));
  }

  const normalizedProgress = normalizePlayerProgressState(progressState);
  const persistedParty = normalizedProgress.party;
  if (!persistedParty || !Array.isArray(persistedParty.members) || !Array.isArray(persistedParty.memberOrder)) {
    return friendlyUnits.map((unit) => cloneUnitConfig(unit));
  }

  const encounterTemplateById = new Map(friendlyUnits.map((unit) => [unit.id, unit]));
  const persistedMemberById = new Map(persistedParty.members.map((member) => [member.id, member]));
  const orderedPersistedUnits = persistedParty.memberOrder
    .filter((memberId) => encounterTemplateById.has(memberId) && persistedMemberById.has(memberId))
    .map((memberId) =>
      mergePersistedPartyMemberIntoUnit(
        encounterTemplateById.get(memberId),
        persistedMemberById.get(memberId)
      )
    );

  if (!orderedPersistedUnits.length) {
    return friendlyUnits.map((unit) => cloneUnitConfig(unit));
  }

  return orderedPersistedUnits;
}

export function serializeUnitToPartyMember(unit) {
  const normalized = normalizeCharacterModel({
    ...unit,
    flags: {
      ...(unit?.flags ?? {}),
      isPartyMember: true,
    },
  });
  if (!normalized) {
    return null;
  }

  return serializeCharacterForPartyState(normalized);
}

export function reconcilePartyProgressWithBattleUnits(
  previousState,
  battleFriendlyUnits,
  encounterFriendlyTemplateIds = []
) {
  const friendlyUnits = Array.isArray(battleFriendlyUnits) ? battleFriendlyUnits : [];
  const activePartyIds = friendlyUnits.map((unit) => unit.id);
  const activePartyIdSet = new Set(activePartyIds);
  const encounterTemplateIdSet = new Set(encounterFriendlyTemplateIds);
  let next = normalizePlayerProgressState(previousState);

  friendlyUnits.forEach((unit) => {
    const serialized = serializeUnitToPartyMember(unit);
    if (!serialized) {
      return;
    }
    next = upsertPartyMember(next, serialized);
  });

  next.party.memberOrder
    .filter((id) => encounterTemplateIdSet.has(id) && !activePartyIdSet.has(id))
    .forEach((id) => {
      next = removePartyMember(next, id);
    });

  const orderTail = next.party.memberOrder.filter((memberId) => !activePartyIdSet.has(memberId));
  return normalizePlayerProgressState({
    ...next,
    party: {
      ...next.party,
      memberOrder: [...activePartyIds, ...orderTail],
    },
  });
}
