import assert from "node:assert/strict";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.window = { localStorage: storage };

const {
  hasPersistedProgressData,
  reconcilePartyProgressWithBattleUnits,
  resolveInitialFriendlyUnits,
} = await import("../src/state/partyPersistence.js");
const {
  PLAYER_PROGRESS_STORAGE_KEY,
  clearProgress,
} = await import("../src/persistence/saveSystem.js");
const {
  createInitialPlayerProgressState,
  normalizePlayerProgressState,
  serializePlayerProgress,
} = await import("../src/state/playerProgress.js");

const defaultFriendlyUnits = [
  {
    id: "protagonist",
    name: "Protagonist",
    archetype: "hero",
    movement: { tilesPerTurn: 4 },
    attack: { range: 1, baseDamage: 22 },
    stats: { maxHp: 120, defense: 12 },
    spawn: { x: 2, y: 4 },
    currentHp: 100,
  },
  {
    id: "guardian-dog",
    name: "Guardian Dog",
    archetype: "dog",
    movement: { tilesPerTurn: 5 },
    attack: { range: 1, baseDamage: 26 },
    stats: { maxHp: 130, defense: 10 },
    spawn: { x: 3, y: 5 },
    currentHp: 130,
  },
];

clearProgress();
assert.equal(hasPersistedProgressData(), false);
const freshParty = resolveInitialFriendlyUnits(
  defaultFriendlyUnits,
  createInitialPlayerProgressState(),
  { hasPersistedData: false }
);
assert.deepEqual(
  freshParty.map((unit) => unit.id),
  ["protagonist", "guardian-dog"],
  "Fresh profile should keep encounter default party composition"
);

const savedState = normalizePlayerProgressState({
  party: {
    memberOrder: ["guardian-dog", "protagonist"],
    members: [
      {
        id: "guardian-dog",
        name: "Guardian Dog",
        archetype: "dog",
        level: 3,
        currentHp: 61,
        maxHp: 77,
      },
      {
        id: "protagonist",
        name: "Hero Prime",
        archetype: "hero",
        level: 4,
        currentHp: 55,
        maxHp: 88,
      },
    ],
  },
});
storage.setItem(PLAYER_PROGRESS_STORAGE_KEY, serializePlayerProgress(savedState));
assert.equal(hasPersistedProgressData(), true);

const loadedParty = resolveInitialFriendlyUnits(defaultFriendlyUnits, savedState, {
  hasPersistedData: true,
});
assert.deepEqual(
  loadedParty.map((unit) => unit.id),
  ["guardian-dog", "protagonist"],
  "Saved party order should control initial battle party order"
);
assert.equal(loadedParty[0].currentHp, 61);
assert.equal(loadedParty[0].stats.maxHp, 77);
assert.equal(loadedParty[1].name, "Hero Prime");

const initialProgress = normalizePlayerProgressState({
  party: {
    memberOrder: ["guardian-dog", "protagonist", "scout-dog"],
    members: [
      {
        id: "guardian-dog",
        name: "Guardian Dog",
        archetype: "dog",
        level: 2,
        currentHp: 40,
        maxHp: 130,
      },
      {
        id: "protagonist",
        name: "Hero Prime",
        archetype: "hero",
        level: 4,
        currentHp: 52,
        maxHp: 88,
      },
      {
        id: "scout-dog",
        name: "Scout Dog",
        archetype: "dog",
        level: 1,
        currentHp: 90,
        maxHp: 100,
      },
    ],
  },
});

const reconciled = reconcilePartyProgressWithBattleUnits(
  initialProgress,
  [
    {
      id: "protagonist",
      name: "Hero Prime",
      archetype: "hero",
      level: 4,
      currentHp: 52,
      stats: { maxHp: 88 },
    },
    {
      id: "elephant-bulwark",
      name: "Elephant Bulwark",
      archetype: "elephant",
      level: 2,
      currentHp: 200,
      stats: { maxHp: 220 },
    },
  ],
  ["protagonist", "guardian-dog", "elephant-bulwark"]
);

assert.ok(reconciled.party.members.some((member) => member.id === "elephant-bulwark"));
assert.ok(!reconciled.party.members.some((member) => member.id === "guardian-dog"));
assert.deepEqual(reconciled.party.memberOrder.slice(0, 2), ["protagonist", "elephant-bulwark"]);
assert.ok(reconciled.party.memberOrder.includes("scout-dog"));
assert.doesNotThrow(() => JSON.parse(JSON.stringify(reconciled)));

console.log("Battle party persistence test passed.");
