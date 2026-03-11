/**
 * @fileoverview
 * Centralized player progress save model for overworld progression.
 *
 * This module is intentionally JSON-friendly so save data can be persisted
 * directly to local storage, backend storage, or files without custom encoders.
 */
import {
  createProtagonistCharacter,
  normalizeCharacterModel,
  serializeCharacterForPartyState,
} from "../models/characterModels.js";

const PLAYER_PROGRESS_SCHEMA_VERSION = 1;
const KEY_BATTLE_OUTCOME_FLAGS = Object.freeze({
  OVERWORLD_FIRST_DRONE_DEFEATED: "defeatedFirstDrone",
  LEVEL1_TRAINING_AMBUSH_CLEARED: "level1TrainingAmbushCleared",
  LEVEL2_CANYON_GAUNTLET_CLEARED: "level2CanyonGauntletCleared",
});
const KEY_BATTLE_OUTCOME_FLAG_DEFAULTS = Object.freeze({
  [KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED]: false,
  [KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED]: false,
  [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED]: false,
});
const ENCOUNTER_ID_TO_KEY_BATTLE_FLAG = Object.freeze({
  "overworld-first-drone": KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED,
  "level-1-training-ambush": KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED,
  "level-2-canyon-gauntlet": KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED,
});

const DEFAULT_OVERWORLD_POSITION = Object.freeze({ x: 2, y: 2 });
const DEFAULT_PARTY_MEMBERS = Object.freeze([
  Object.freeze(serializeCharacterForPartyState(createProtagonistCharacter())),
]);

const cloneJsonValue = (value) => JSON.parse(JSON.stringify(value));

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizePosition(position, fallbackPosition = DEFAULT_OVERWORLD_POSITION) {
  if (!isPlainObject(position)) {
    return { ...fallbackPosition };
  }

  return {
    x: Math.max(0, Math.floor(toFiniteNumber(position.x, fallbackPosition.x))),
    y: Math.max(0, Math.floor(toFiniteNumber(position.y, fallbackPosition.y))),
  };
}

function normalizePartyMember(member) {
  const normalized = normalizeCharacterModel({
    ...(isPlainObject(member) ? member : {}),
    flags: {
      ...(member?.flags ?? {}),
      isPartyMember: true,
    },
  });
  if (!normalized) {
    return null;
  }

  return serializeCharacterForPartyState(normalized);
}

function normalizePartyMembers(members) {
  if (!Array.isArray(members)) {
    return cloneJsonValue(DEFAULT_PARTY_MEMBERS);
  }

  const normalized = [];
  const seen = new Set();
  members.forEach((candidate) => {
    const member = normalizePartyMember(candidate);
    if (!member || seen.has(member.id)) {
      return;
    }
    normalized.push(member);
    seen.add(member.id);
  });

  if (normalized.length === 0) {
    return cloneJsonValue(DEFAULT_PARTY_MEMBERS);
  }

  return normalized;
}

function normalizeEncounterResults(outcomes) {
  if (!isPlainObject(outcomes)) {
    return {};
  }

  return Object.entries(outcomes).reduce((acc, [encounterId, value]) => {
    const trimmedEncounterId = encounterId.trim();
    if (!trimmedEncounterId) {
      return acc;
    }

    if (typeof value === "string") {
      acc[trimmedEncounterId] = value;
      return acc;
    }

    if (isPlainObject(value) && typeof value.result === "string") {
      acc[trimmedEncounterId] = {
        result: value.result,
        recordedAt: typeof value.recordedAt === "string" ? value.recordedAt : null,
      };
    }

    return acc;
  }, {});
}

function normalizeQuestFlags(flags) {
  if (!isPlainObject(flags)) {
    return {};
  }

  return Object.entries(flags).reduce((acc, [flagKey, flagValue]) => {
    const normalizedFlagKey = typeof flagKey === "string" ? flagKey.trim() : "";
    if (!normalizedFlagKey) {
      return acc;
    }
    acc[normalizedFlagKey] = flagValue === true;
    return acc;
  }, {});
}

function normalizeInventoryItems(items) {
  if (!isPlainObject(items)) {
    return {};
  }

  return Object.entries(items).reduce((acc, [itemId, amount]) => {
    const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";
    if (!normalizedItemId) {
      return acc;
    }

    const normalizedAmount = Math.max(0, Math.floor(toFiniteNumber(amount, 0)));
    if (normalizedAmount > 0) {
      acc[normalizedItemId] = normalizedAmount;
    }

    return acc;
  }, {});
}

function isOutcomeVictory(outcome) {
  if (typeof outcome === "string") {
    return outcome === "victory";
  }
  return isPlainObject(outcome) && outcome.result === "victory";
}

function normalizeKeyBattleFlags(keyBattles, encounterResults = {}) {
  const normalized = { ...KEY_BATTLE_OUTCOME_FLAG_DEFAULTS };

  if (isPlainObject(keyBattles)) {
    Object.values(KEY_BATTLE_OUTCOME_FLAGS).forEach((flagKey) => {
      normalized[flagKey] = keyBattles[flagKey] === true;
    });
  }

  Object.entries(ENCOUNTER_ID_TO_KEY_BATTLE_FLAG).forEach(([encounterId, flagKey]) => {
    if (normalized[flagKey]) {
      return;
    }

    if (isOutcomeVictory(encounterResults[encounterId])) {
      normalized[flagKey] = true;
    }
  });

  return normalized;
}

function normalizeBattleOutcomes(outcomes) {
  if (!isPlainObject(outcomes)) {
    return {
      keyBattles: { ...KEY_BATTLE_OUTCOME_FLAG_DEFAULTS },
      encounterResults: {},
    };
  }

  const hasStructuredShape = isPlainObject(outcomes.keyBattles) || isPlainObject(outcomes.encounterResults);
  const legacyEncounterResults = hasStructuredShape ? {} : normalizeEncounterResults(outcomes);
  const explicitEncounterResults = normalizeEncounterResults(outcomes.encounterResults);
  const encounterResults = {
    ...legacyEncounterResults,
    ...explicitEncounterResults,
  };

  return {
    keyBattles: normalizeKeyBattleFlags(outcomes.keyBattles, encounterResults),
    encounterResults,
  };
}

/**
 * Build the default player progress state.
 *
 * Fields:
 * - schemaVersion: Save schema version for future migration handling.
 * - overworld: Position and scene-entry references used by overworld/level scenes.
 *   - position: Current tile coordinate on overworld map.
 *   - spawnPointId: Last named overworld spawn marker (for level returns).
 *   - currentSceneKey: Last active exploration scene key.
 * - party: Battle party composition used by encounter systems.
 *   - memberOrder: Party order for future UI/turn-order style systems.
 *   - members: JSON-safe member summaries keyed by `id` values used in encounters.
 * - inventory:
 *   - items: Item counts keyed by item IDs used by overworld progression.
 * - battleOutcomes:
 *   - keyBattles: Small, stable booleans for story/tutorial/boss progression gates.
 *   - encounterResults: Optional per-encounter history keyed by encounter ID.
 */
export function createInitialPlayerProgressState(overrides = {}) {
  const defaultState = {
    schemaVersion: PLAYER_PROGRESS_SCHEMA_VERSION,
    overworld: {
      position: { ...DEFAULT_OVERWORLD_POSITION },
      spawnPointId: "default",
      currentSceneKey: "OverworldScene",
    },
    party: {
      memberOrder: DEFAULT_PARTY_MEMBERS.map((member) => member.id),
      members: cloneJsonValue(DEFAULT_PARTY_MEMBERS),
    },
    inventory: {
      items: {},
    },
    battleOutcomes: {
      keyBattles: { ...KEY_BATTLE_OUTCOME_FLAG_DEFAULTS },
      encounterResults: {},
    },
    questFlags: {},
  };

  return normalizePlayerProgressState({
    ...defaultState,
    ...cloneJsonValue(overrides),
  });
}

/**
 * Ensure unknown/parsed state data matches the current save schema shape.
 */
export function normalizePlayerProgressState(state) {
  const source = isPlainObject(state) ? state : {};
  const normalizedMembers = normalizePartyMembers(source.party?.members);
  const normalizedOrder = Array.isArray(source.party?.memberOrder)
    ? source.party.memberOrder.filter((memberId) =>
        normalizedMembers.some((member) => member.id === memberId)
      )
    : [];

  normalizedMembers.forEach((member) => {
    if (!normalizedOrder.includes(member.id)) {
      normalizedOrder.push(member.id);
    }
  });

  return {
    schemaVersion: PLAYER_PROGRESS_SCHEMA_VERSION,
    overworld: {
      position: normalizePosition(source.overworld?.position),
      spawnPointId:
        typeof source.overworld?.spawnPointId === "string" && source.overworld.spawnPointId.trim()
          ? source.overworld.spawnPointId.trim()
          : "default",
      currentSceneKey:
        typeof source.overworld?.currentSceneKey === "string" && source.overworld.currentSceneKey.trim()
          ? source.overworld.currentSceneKey.trim()
          : "OverworldScene",
    },
    party: {
      memberOrder: normalizedOrder,
      members: normalizedMembers,
    },
    inventory: {
      items: normalizeInventoryItems(source.inventory?.items),
    },
    battleOutcomes: normalizeBattleOutcomes(source.battleOutcomes),
    questFlags: normalizeQuestFlags(source.questFlags),
  };
}

function normalizeBattleOutcomeFlagKey(flagKey) {
  const normalizedFlagKey = typeof flagKey === "string" ? flagKey.trim() : "";
  if (!normalizedFlagKey) {
    return null;
  }

  const allowed = Object.values(KEY_BATTLE_OUTCOME_FLAGS);
  if (!allowed.includes(normalizedFlagKey)) {
    return null;
  }

  return normalizedFlagKey;
}

export function resolveKeyBattleOutcomeFlagForEncounter(encounterId) {
  const normalizedEncounterId = typeof encounterId === "string" ? encounterId.trim() : "";
  if (!normalizedEncounterId) {
    return null;
  }

  return ENCOUNTER_ID_TO_KEY_BATTLE_FLAG[normalizedEncounterId] ?? null;
}

export function getBattleOutcomeFlag(state, flagKey) {
  const current = normalizePlayerProgressState(state);
  const normalizedFlagKey = normalizeBattleOutcomeFlagKey(flagKey);
  if (!normalizedFlagKey) {
    return false;
  }

  return current.battleOutcomes.keyBattles[normalizedFlagKey] === true;
}

export function setBattleOutcomeFlag(previousState, flagKey, value = true) {
  const current = normalizePlayerProgressState(previousState);
  const normalizedFlagKey = normalizeBattleOutcomeFlagKey(flagKey);
  if (!normalizedFlagKey) {
    return current;
  }

  return {
    ...current,
    battleOutcomes: {
      ...current.battleOutcomes,
      keyBattles: {
        ...current.battleOutcomes.keyBattles,
        [normalizedFlagKey]: value === true,
      },
    },
  };
}

export function getQuestFlag(state, flagKey) {
  const current = normalizePlayerProgressState(state);
  const normalizedFlagKey = typeof flagKey === "string" ? flagKey.trim() : "";
  if (!normalizedFlagKey) {
    return false;
  }

  return current.questFlags[normalizedFlagKey] === true;
}

export function setQuestFlag(previousState, flagKey, value = true) {
  const normalizedFlagKey = typeof flagKey === "string" ? flagKey.trim() : "";
  if (!normalizedFlagKey) {
    return normalizePlayerProgressState(previousState);
  }

  return setQuestFlags(previousState, {
    [normalizedFlagKey]: value === true,
  });
}

export function setQuestFlags(previousState, flags = {}) {
  const current = normalizePlayerProgressState(previousState);
  const normalizedFlags = normalizeQuestFlags(flags);
  if (Object.keys(normalizedFlags).length === 0) {
    return current;
  }

  return {
    ...current,
    questFlags: {
      ...current.questFlags,
      ...normalizedFlags,
    },
  };
}

/**
 * Update overworld tile position and optional routing metadata.
 */
export function updateOverworldPosition(previousState, position, options = {}) {
  const current = normalizePlayerProgressState(previousState);

  return {
    ...current,
    overworld: {
      ...current.overworld,
      position: normalizePosition(position, current.overworld.position),
      spawnPointId:
        typeof options.spawnPointId === "string" && options.spawnPointId.trim()
          ? options.spawnPointId.trim()
          : current.overworld.spawnPointId,
      currentSceneKey:
        typeof options.currentSceneKey === "string" && options.currentSceneKey.trim()
          ? options.currentSceneKey.trim()
          : current.overworld.currentSceneKey,
    },
  };
}

/**
 * Add or replace a party member by `id`.
 */
export function upsertPartyMember(previousState, partyMember) {
  const current = normalizePlayerProgressState(previousState);
  const normalized = normalizePartyMember(partyMember);

  if (!normalized) {
    return current;
  }

  const existingIndex = current.party.members.findIndex((member) => member.id === normalized.id);
  const nextMembers = [...current.party.members];
  if (existingIndex === -1) {
    nextMembers.push(normalized);
  } else {
    nextMembers[existingIndex] = normalized;
  }

  const nextOrder = current.party.memberOrder.includes(normalized.id)
    ? [...current.party.memberOrder]
    : [...current.party.memberOrder, normalized.id];

  return {
    ...current,
    party: {
      members: nextMembers,
      memberOrder: nextOrder,
    },
  };
}

/**
 * Remove a party member by `id`.
 */
export function removePartyMember(previousState, memberId) {
  const current = normalizePlayerProgressState(previousState);
  const id = typeof memberId === "string" ? memberId.trim() : "";
  if (!id) {
    return current;
  }

  return {
    ...current,
    party: {
      members: current.party.members.filter((member) => member.id !== id),
      memberOrder: current.party.memberOrder.filter((orderedId) => orderedId !== id),
    },
  };
}

/**
 * Record a battle completion outcome under a stable encounter name/ID.
 *
 * `outcome` can be:
 * - string (e.g. "victory", "defeat")
 * - object: { result: "victory", recordedAt?: ISOString }
 */
export function recordBattleOutcome(previousState, encounterId, outcome) {
  const current = normalizePlayerProgressState(previousState);
  const normalizedEncounterId = typeof encounterId === "string" ? encounterId.trim() : "";
  if (!normalizedEncounterId) {
    return current;
  }

  let normalizedOutcome = null;
  if (typeof outcome === "string") {
    normalizedOutcome = outcome;
  } else if (isPlainObject(outcome) && typeof outcome.result === "string") {
    normalizedOutcome = {
      result: outcome.result,
      recordedAt: typeof outcome.recordedAt === "string" ? outcome.recordedAt : null,
    };
  }

  if (!normalizedOutcome) {
    return current;
  }

  let next = {
    ...current,
    battleOutcomes: {
      ...current.battleOutcomes,
      encounterResults: {
        ...current.battleOutcomes.encounterResults,
        [normalizedEncounterId]: normalizedOutcome,
      },
    },
  };

  if (isOutcomeVictory(normalizedOutcome)) {
    const keyBattleFlag = resolveKeyBattleOutcomeFlagForEncounter(normalizedEncounterId);
    if (keyBattleFlag) {
      next = setBattleOutcomeFlag(next, keyBattleFlag, true);
    }
  }

  return next;
}

/**
 * Convert progress state to JSON for persistence storage.
 */
export function serializePlayerProgress(state, spacing = 0) {
  return JSON.stringify(normalizePlayerProgressState(state), null, spacing);
}

/**
 * Parse persisted JSON back into normalized progress state.
 */
export function deserializePlayerProgress(serializedState) {
  if (typeof serializedState !== "string") {
    throw new TypeError("deserializePlayerProgress expected a JSON string.");
  }

  const parsed = JSON.parse(serializedState);
  return normalizePlayerProgressState(parsed);
}

export { KEY_BATTLE_OUTCOME_FLAGS, PLAYER_PROGRESS_SCHEMA_VERSION };
