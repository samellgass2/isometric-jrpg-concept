import assert from "node:assert/strict";
import {
  addInventoryItem,
  getGameState,
  initGameState,
  setPartyMemberHealth,
  setStoryFlag,
} from "../src/state/gameState.js";
import { PLAYER_PROGRESS_STORAGE_KEY } from "../src/persistence/saveSystem.js";
import {
  buildDebugStateSnapshot,
  loadGame,
  resolveResumeTarget,
  saveGame,
} from "../src/persistence/runtimeStateTools.js";
import { createInitialPlayerProgressState } from "../src/state/playerProgress.js";

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

class MemoryRegistry {
  constructor(seed = {}) {
    this.state = new Map(Object.entries(seed));
  }

  get(key) {
    return this.state.get(key);
  }

  set(key, value) {
    this.state.set(key, value);
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.window = { localStorage: storage };

const game = {
  registry: new MemoryRegistry({
    playerProgress: createInitialPlayerProgressState(),
  }),
};

initGameState();
setPartyMemberHealth("protagonist", { currentHp: 73, maxHp: 111 });
addInventoryItem("workshop-pass", 2);
setStoryFlag("quest.workshopGateUnlocked", true);
const saved = saveGame(game, { currentSceneKey: "Level1Scene", spawnPointId: "level-1-return" });

assert.equal(saved.overworld.currentSceneKey, "Level1Scene");
assert.equal(saved.overworld.spawnPointId, "level-1-return");
assert.equal(saved.inventory.items["workshop-pass"], 2);
assert.equal(saved.questFlags["quest.workshopGateUnlocked"], true);

const persistedRaw = storage.getItem(PLAYER_PROGRESS_STORAGE_KEY);
assert.equal(typeof persistedRaw, "string");
assert.doesNotThrow(() => JSON.parse(persistedRaw));

initGameState();
loadGame(game);
const loadedState = getGameState();
assert.equal(loadedState.inventory.items["workshop-pass"], 2);
assert.equal(loadedState.storyFlags["quest.workshopGateUnlocked"], true);
assert.equal(loadedState.party.members.find((member) => member.id === "protagonist")?.currentHp, 73);

const snapshot = buildDebugStateSnapshot({
  storyFlagKeys: ["quest.workshopGateUnlocked"],
});
assert.equal(snapshot.inventory["workshop-pass"], 2);
assert.equal(snapshot.storyFlags["quest.workshopGateUnlocked"], true);
assert.ok(Array.isArray(snapshot.party));

const { resumeSceneKey } = resolveResumeTarget(saved);
assert.equal(resumeSceneKey, "Level1Scene");

storage.setItem(PLAYER_PROGRESS_STORAGE_KEY, "{broken-json");
const fallback = loadGame(game);
assert.deepEqual(fallback, createInitialPlayerProgressState());

console.log("Runtime save/load state tools test passed.");
