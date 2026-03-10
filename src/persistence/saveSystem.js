import {
  createInitialPlayerProgressState,
  deserializePlayerProgress,
  serializePlayerProgress,
} from "../state/playerProgress.js";

export const PLAYER_PROGRESS_STORAGE_KEY = "playerProgress";

function getLocalStorage() {
  const storage =
    globalThis?.localStorage ??
    globalThis?.window?.localStorage ??
    null;

  if (!storage) {
    return null;
  }

  try {
    const probeKey = "__player_progress_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch (_error) {
    return null;
  }
}

export function saveProgress(state) {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    const serialized = serializePlayerProgress(state);
    storage.setItem(PLAYER_PROGRESS_STORAGE_KEY, serialized);
    return true;
  } catch (_error) {
    return false;
  }
}

export function loadProgress() {
  const fallbackState = createInitialPlayerProgressState();
  const storage = getLocalStorage();
  if (!storage) {
    return fallbackState;
  }

  try {
    const raw = storage.getItem(PLAYER_PROGRESS_STORAGE_KEY);
    if (typeof raw !== "string") {
      return fallbackState;
    }

    return deserializePlayerProgress(raw);
  } catch (_error) {
    return fallbackState;
  }
}

export function clearProgress() {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(PLAYER_PROGRESS_STORAGE_KEY);
    return true;
  } catch (_error) {
    return false;
  }
}
