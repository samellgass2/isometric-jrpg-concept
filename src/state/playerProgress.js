/**
 * @fileoverview
 * Centralized player progress save model for overworld progression.
 *
 * This module is intentionally JSON-friendly so save data can be persisted
 * directly to local storage, backend storage, or files without custom encoders.
 */

const PLAYER_PROGRESS_SCHEMA_VERSION = 1;

const DEFAULT_OVERWORLD_POSITION = Object.freeze({ x: 2, y: 2 });
const DEFAULT_PARTY_MEMBERS = Object.freeze([
  Object.freeze({
    id: "protagonist",
    name: "Protagonist",
    archetype: "hero",
    level: 1,
    currentHp: 100,
    maxHp: 100,
  }),
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
  if (!isPlainObject(member)) {
    return null;
  }

  const id = typeof member.id === "string" ? member.id.trim() : "";
  if (!id) {
    return null;
  }

  const maxHp = Math.max(1, Math.floor(toFiniteNumber(member.maxHp, 100)));
  const currentHp = Math.max(0, Math.min(maxHp, Math.floor(toFiniteNumber(member.currentHp, maxHp))));

  return {
    id,
    name: typeof member.name === "string" && member.name.trim() ? member.name.trim() : id,
    archetype: typeof member.archetype === "string" ? member.archetype : null,
    level: Math.max(1, Math.floor(toFiniteNumber(member.level, 1))),
    currentHp,
    maxHp,
  };
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

function normalizeBattleOutcomes(outcomes) {
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
 * - battleOutcomes: Encounter completion records by encounter ID (for clear flags,
 *   re-trigger prevention, and progression gates).
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
    battleOutcomes: {},
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
    battleOutcomes: normalizeBattleOutcomes(source.battleOutcomes),
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

  return {
    ...current,
    battleOutcomes: {
      ...current.battleOutcomes,
      [normalizedEncounterId]: normalizedOutcome,
    },
  };
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

export { PLAYER_PROGRESS_SCHEMA_VERSION };
