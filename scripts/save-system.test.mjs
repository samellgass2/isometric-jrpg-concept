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
  clearProgress,
  loadProgress,
  PLAYER_PROGRESS_STORAGE_KEY,
  saveProgress,
} = await import("../src/persistence/saveSystem.js");
const { createInitialPlayerProgressState, updateOverworldPosition } = await import(
  "../src/state/playerProgress.js"
);

const defaultState = createInitialPlayerProgressState();
clearProgress();
assert.deepEqual(loadProgress(), defaultState);

const movedState = updateOverworldPosition(defaultState, { x: 9, y: 6 }, {
  spawnPointId: "level-1-return",
  currentSceneKey: "OverworldScene",
});
assert.equal(saveProgress(movedState), true);
const savedRaw = storage.getItem(PLAYER_PROGRESS_STORAGE_KEY);
assert.equal(typeof savedRaw, "string");
assert.ok(savedRaw.includes("\"overworld\""));

const loadedState = loadProgress();
assert.deepEqual(loadedState, movedState);

storage.setItem(PLAYER_PROGRESS_STORAGE_KEY, "{not-valid-json");
assert.deepEqual(loadProgress(), defaultState);

assert.equal(clearProgress(), true);
assert.equal(storage.getItem(PLAYER_PROGRESS_STORAGE_KEY), null);
assert.deepEqual(loadProgress(), defaultState);

const throwingStorage = {
  getItem() {
    return null;
  },
  setItem() {
    throw new Error("write failed");
  },
  removeItem() {
    return undefined;
  },
};
globalThis.localStorage = throwingStorage;
globalThis.window = { localStorage: throwingStorage };
assert.equal(saveProgress(createInitialPlayerProgressState()), false);

console.log("Save system persistence test passed.");
