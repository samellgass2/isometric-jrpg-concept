import { PLAYER_PROGRESS_STORAGE_KEY } from "../persistence/saveSystem.js";
import {
  normalizePlayerProgressState,
  removePartyMember,
  upsertPartyMember,
} from "./playerProgress.js";

function cloneUnitConfig(unit) {
  return {
    ...unit,
    movement: { ...(unit.movement ?? {}) },
    attack: { ...(unit.attack ?? {}) },
    stats: { ...(unit.stats ?? {}) },
    abilities: Array.isArray(unit.abilities) ? [...unit.abilities] : [],
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

  return {
    ...baseUnit,
    name: persistedMember.name || baseUnit.name,
    archetype: persistedMember.archetype ?? baseUnit.archetype,
    level: persistedMember.level ?? baseUnit.level,
    currentHp: persistedMember.currentHp,
    stats: {
      ...baseUnit.stats,
      maxHp: persistedMember.maxHp,
    },
  };
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
  return {
    id: unit.id,
    name: unit.name,
    archetype: unit.archetype ?? null,
    level: unit.level ?? 1,
    currentHp: Math.max(0, Math.floor(unit.currentHp)),
    maxHp: Math.max(1, Math.floor(unit.stats?.maxHp ?? unit.currentHp ?? 1)),
  };
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
    next = upsertPartyMember(next, serializeUnitToPartyMember(unit));
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
