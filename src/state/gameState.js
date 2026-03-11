import { normalizePlayerProgressState } from "./playerProgress.js";

const DEFAULT_PARTY_MEMBER = Object.freeze({
  id: "protagonist",
  name: "Protagonist",
  archetype: "hero",
  level: 1,
  currentHp: 100,
  maxHp: 100,
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeId(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function toInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizePartyMember(member) {
  if (!isPlainObject(member)) {
    return null;
  }

  const id = normalizeId(member.id);
  if (!id) {
    return null;
  }

  const maxHp = Math.max(1, toInteger(member.maxHp, 100));
  const currentHp = Math.max(0, Math.min(maxHp, toInteger(member.currentHp, maxHp)));

  return {
    id,
    name: normalizeId(member.name) || id,
    archetype: typeof member.archetype === "string" ? member.archetype : null,
    level: Math.max(1, toInteger(member.level, 1)),
    currentHp,
    maxHp,
  };
}

function normalizePartyMembers(members) {
  if (!Array.isArray(members)) {
    return [cloneJson(DEFAULT_PARTY_MEMBER)];
  }

  const seen = new Set();
  const normalized = [];
  members.forEach((member) => {
    const next = normalizePartyMember(member);
    if (!next || seen.has(next.id)) {
      return;
    }
    seen.add(next.id);
    normalized.push(next);
  });

  if (normalized.length === 0) {
    return [cloneJson(DEFAULT_PARTY_MEMBER)];
  }

  return normalized;
}

function normalizePartyOrder(order, members) {
  const normalized = [];
  const memberIds = members.map((member) => member.id);

  if (Array.isArray(order)) {
    order.forEach((candidateId) => {
      const id = normalizeId(candidateId);
      if (!id || !memberIds.includes(id) || normalized.includes(id)) {
        return;
      }
      normalized.push(id);
    });
  }

  memberIds.forEach((id) => {
    if (!normalized.includes(id)) {
      normalized.push(id);
    }
  });

  return normalized;
}

function normalizeInventoryItems(items) {
  if (!isPlainObject(items)) {
    return {};
  }

  return Object.entries(items).reduce((acc, [itemId, amount]) => {
    const id = normalizeId(itemId);
    if (!id) {
      return acc;
    }

    const count = Math.max(0, toInteger(amount, 0));
    if (count > 0) {
      acc[id] = count;
    }

    return acc;
  }, {});
}

function normalizeStoryFlags(flags) {
  if (!isPlainObject(flags)) {
    return {};
  }

  return Object.entries(flags).reduce((acc, [flagKey, flagValue]) => {
    const key = normalizeId(flagKey);
    if (!key) {
      return acc;
    }
    acc[key] = flagValue;
    return acc;
  }, {});
}

function createDefaultState() {
  const partyMembers = [cloneJson(DEFAULT_PARTY_MEMBER)];
  return {
    schemaVersion: 1,
    party: {
      members: partyMembers,
      memberOrder: partyMembers.map((member) => member.id),
    },
    inventory: {
      items: {},
    },
    storyFlags: {},
  };
}

function normalizeGameState(state = {}) {
  const source = isPlainObject(state) ? state : {};
  const partyMembers = normalizePartyMembers(source.party?.members);

  return {
    schemaVersion: 1,
    party: {
      members: partyMembers,
      memberOrder: normalizePartyOrder(source.party?.memberOrder, partyMembers),
    },
    inventory: {
      items: normalizeInventoryItems(source.inventory?.items),
    },
    storyFlags: normalizeStoryFlags(source.storyFlags),
  };
}

class GameStateStore {
  constructor() {
    this.state = normalizeGameState(createDefaultState());
    this.subscribers = new Set();
  }

  snapshot() {
    return cloneJson(this.state);
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  reset(overrides = {}) {
    return this.setState({
      ...createDefaultState(),
      ...cloneJson(overrides),
    });
  }

  setState(nextState) {
    this.state = normalizeGameState(nextState);
    const snapshot = this.snapshot();
    this.subscribers.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  update(updater) {
    const current = this.snapshot();
    const nextState = typeof updater === "function" ? updater(current) : current;
    return this.setState(nextState);
  }

  getPartyMember(memberId) {
    const id = normalizeId(memberId);
    if (!id) {
      return null;
    }

    const match = this.state.party.members.find((member) => member.id === id);
    return match ? cloneJson(match) : null;
  }

  addPartyMember(member) {
    return this.update((current) => {
      const normalized = normalizePartyMember(member);
      if (!normalized) {
        return current;
      }

      const members = [...current.party.members];
      const existingIndex = members.findIndex((entry) => entry.id === normalized.id);
      if (existingIndex >= 0) {
        members[existingIndex] = normalized;
      } else {
        members.push(normalized);
      }

      const memberOrder = current.party.memberOrder.includes(normalized.id)
        ? [...current.party.memberOrder]
        : [...current.party.memberOrder, normalized.id];

      return {
        ...current,
        party: {
          members,
          memberOrder,
        },
      };
    });
  }

  removePartyMember(memberId) {
    const id = normalizeId(memberId);
    if (!id) {
      return this.snapshot();
    }

    return this.update((current) => ({
      ...current,
      party: {
        members: current.party.members.filter((member) => member.id !== id),
        memberOrder: current.party.memberOrder.filter((orderedId) => orderedId !== id),
      },
    }));
  }

  adjustPartyMemberHealth(memberId, delta = 0) {
    const id = normalizeId(memberId);
    const normalizedDelta = toInteger(delta, 0);
    if (!id || normalizedDelta === 0) {
      return this.snapshot();
    }

    return this.update((current) => {
      const members = current.party.members.map((member) => {
        if (member.id !== id) {
          return member;
        }

        const currentHp = Math.max(0, Math.min(member.maxHp, member.currentHp + normalizedDelta));
        return {
          ...member,
          currentHp,
        };
      });

      return {
        ...current,
        party: {
          ...current.party,
          members,
        },
      };
    });
  }

  setPartyMemberHealth(memberId, health) {
    const id = normalizeId(memberId);
    if (!id || !isPlainObject(health)) {
      return this.snapshot();
    }

    return this.update((current) => {
      const members = current.party.members.map((member) => {
        if (member.id !== id) {
          return member;
        }

        const maxHp = Math.max(1, toInteger(health.maxHp, member.maxHp));
        const currentHp = Math.max(0, Math.min(maxHp, toInteger(health.currentHp, member.currentHp)));
        return {
          ...member,
          maxHp,
          currentHp,
        };
      });

      return {
        ...current,
        party: {
          ...current.party,
          members,
        },
      };
    });
  }

  addInventoryItem(itemId, amount = 1) {
    const id = normalizeId(itemId);
    const normalizedAmount = Math.max(0, toInteger(amount, 1));
    if (!id || normalizedAmount === 0) {
      return this.snapshot();
    }

    return this.update((current) => {
      const existing = current.inventory.items[id] ?? 0;

      return {
        ...current,
        inventory: {
          items: {
            ...current.inventory.items,
            [id]: existing + normalizedAmount,
          },
        },
      };
    });
  }

  removeInventoryItem(itemId, amount = 1) {
    const id = normalizeId(itemId);
    const normalizedAmount = Math.max(0, toInteger(amount, 1));
    if (!id || normalizedAmount === 0) {
      return this.snapshot();
    }

    return this.update((current) => {
      const existing = current.inventory.items[id] ?? 0;
      const nextCount = Math.max(0, existing - normalizedAmount);
      const nextItems = {
        ...current.inventory.items,
      };

      if (nextCount === 0) {
        delete nextItems[id];
      } else {
        nextItems[id] = nextCount;
      }

      return {
        ...current,
        inventory: {
          items: nextItems,
        },
      };
    });
  }

  setStoryFlag(flagKey, value = true) {
    const key = normalizeId(flagKey);
    if (!key) {
      return this.snapshot();
    }

    return this.update((current) => ({
      ...current,
      storyFlags: {
        ...current.storyFlags,
        [key]: value,
      },
    }));
  }

  setStoryFlags(flags = {}) {
    const normalizedFlags = normalizeStoryFlags(flags);
    if (Object.keys(normalizedFlags).length === 0) {
      return this.snapshot();
    }

    return this.update((current) => ({
      ...current,
      storyFlags: {
        ...current.storyFlags,
        ...normalizedFlags,
      },
    }));
  }

  getStoryFlag(flagKey, fallback = false) {
    const key = normalizeId(flagKey);
    if (!key) {
      return fallback;
    }

    return this.state.storyFlags[key] ?? fallback;
  }

  hasStoryFlag(flagKey) {
    return this.getStoryFlag(flagKey, false) === true;
  }
}

const gameStateStore = new GameStateStore();

function createGameStateFromPlayerProgress(progressState, options = {}) {
  const progress = normalizePlayerProgressState(progressState);
  const includeBattleOutcomeFlags = options.includeBattleOutcomeFlags !== false;
  const partyMembers = Array.isArray(progress.party?.members) ? progress.party.members : [];
  const storyFlags = {
    ...progress.questFlags,
  };

  if (includeBattleOutcomeFlags && isPlainObject(progress.battleOutcomes?.keyBattles)) {
    Object.assign(storyFlags, progress.battleOutcomes.keyBattles);
  }

  return normalizeGameState({
    party: {
      members: partyMembers,
      memberOrder: progress.party?.memberOrder,
    },
    inventory: {
      items: options.inventoryItems ?? {},
    },
    storyFlags,
  });
}

function applyGameStateToPlayerProgress(gameState, previousProgressState) {
  const base = normalizePlayerProgressState(previousProgressState);
  const normalizedGameState = normalizeGameState(gameState);

  return normalizePlayerProgressState({
    ...base,
    party: {
      members: normalizedGameState.party.members,
      memberOrder: normalizedGameState.party.memberOrder,
    },
    questFlags: Object.entries(normalizedGameState.storyFlags).reduce((acc, [flagKey, value]) => {
      if (value === true || value === false) {
        acc[flagKey] = value;
      }
      return acc;
    }, { ...base.questFlags }),
    battleOutcomes: {
      ...base.battleOutcomes,
      keyBattles: {
        ...base.battleOutcomes.keyBattles,
        ...Object.entries(normalizedGameState.storyFlags).reduce((acc, [flagKey, value]) => {
          if (Object.prototype.hasOwnProperty.call(base.battleOutcomes.keyBattles, flagKey)) {
            acc[flagKey] = value === true;
          }
          return acc;
        }, {}),
      },
    },
  });
}

/**
 * Initialize a new in-memory game state snapshot.
 */
export function initGameState(overrides = {}) {
  return gameStateStore.reset(overrides);
}

/**
 * Initialize the game state from persisted player progress.
 */
export function hydrateGameStateFromProgress(progressState, options = {}) {
  return gameStateStore.setState(createGameStateFromPlayerProgress(progressState, options));
}

/**
 * Read the current game state snapshot.
 */
export function getGameState() {
  return gameStateStore.snapshot();
}

/**
 * Subscribe to game state changes.
 */
export function subscribeToGameState(listener) {
  return gameStateStore.subscribe(listener);
}

export function getPartyMember(memberId) {
  return gameStateStore.getPartyMember(memberId);
}

export function addPartyMember(member) {
  return gameStateStore.addPartyMember(member);
}

export function removePartyMember(memberId) {
  return gameStateStore.removePartyMember(memberId);
}

/**
 * Adjust current HP by a signed delta value.
 */
export function adjustPartyMemberHealth(memberId, delta = 0) {
  return gameStateStore.adjustPartyMemberHealth(memberId, delta);
}

/**
 * Set an absolute HP snapshot for a party member.
 */
export function setPartyMemberHealth(memberId, health) {
  return gameStateStore.setPartyMemberHealth(memberId, health);
}

export function addInventoryItem(itemId, amount = 1) {
  return gameStateStore.addInventoryItem(itemId, amount);
}

export function removeInventoryItem(itemId, amount = 1) {
  return gameStateStore.removeInventoryItem(itemId, amount);
}

export function getInventoryCount(itemId) {
  const id = normalizeId(itemId);
  if (!id) {
    return 0;
  }
  return gameStateStore.snapshot().inventory.items[id] ?? 0;
}

export function setStoryFlag(flagKey, value = true) {
  return gameStateStore.setStoryFlag(flagKey, value);
}

export function setStoryFlags(flags = {}) {
  return gameStateStore.setStoryFlags(flags);
}

export function getStoryFlag(flagKey, fallback = false) {
  return gameStateStore.getStoryFlag(flagKey, fallback);
}

export function hasStoryFlag(flagKey) {
  return gameStateStore.hasStoryFlag(flagKey);
}

export function exportGameStateToPlayerProgress(previousProgressState) {
  return applyGameStateToPlayerProgress(gameStateStore.snapshot(), previousProgressState);
}

export { createGameStateFromPlayerProgress, applyGameStateToPlayerProgress };
