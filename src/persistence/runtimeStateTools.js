import { loadProgress, saveProgress } from "./saveSystem.js";
import {
  exportGameStateToPlayerProgress,
  getGameState,
  hydrateGameStateFromProgress,
} from "../state/gameState.js";
import { normalizePlayerProgressState } from "../state/playerProgress.js";

function normalizeSceneKey(value, fallback = "OverworldScene") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function getRegistryProgress(game) {
  const fromRegistry = game?.registry?.get?.("playerProgress");
  if (fromRegistry) {
    return normalizePlayerProgressState(fromRegistry);
  }
  return normalizePlayerProgressState(loadProgress());
}

function setRegistryProgress(game, progressState) {
  game?.registry?.set?.("playerProgress", progressState);
  hydrateGameStateFromProgress(progressState);
}

export function resolveResumeTarget(progressState, fallbackSceneKey = "OverworldScene") {
  const progress = normalizePlayerProgressState(progressState);
  const resumeSceneKey = normalizeSceneKey(progress.overworld?.currentSceneKey, fallbackSceneKey);
  const resumeData =
    resumeSceneKey === "OverworldScene"
      ? { spawnPointId: progress.overworld?.spawnPointId }
      : {};

  return { resumeSceneKey, resumeData };
}

export function saveGame(game, options = {}) {
  const baseProgress = getRegistryProgress(game);
  const mergedProgress = exportGameStateToPlayerProgress(baseProgress);
  const nextSceneKey =
    typeof options.currentSceneKey === "string" && options.currentSceneKey.trim()
      ? options.currentSceneKey.trim()
      : mergedProgress.overworld?.currentSceneKey;
  const nextSpawnPointId =
    typeof options.spawnPointId === "string" && options.spawnPointId.trim()
      ? options.spawnPointId.trim()
      : mergedProgress.overworld?.spawnPointId;

  const normalized = normalizePlayerProgressState({
    ...mergedProgress,
    overworld: {
      ...mergedProgress.overworld,
      currentSceneKey: normalizeSceneKey(nextSceneKey, "OverworldScene"),
      spawnPointId: nextSpawnPointId,
    },
  });

  setRegistryProgress(game, normalized);
  saveProgress(normalized);
  return normalized;
}

export function loadGame(game) {
  const loaded = normalizePlayerProgressState(loadProgress());
  setRegistryProgress(game, loaded);
  return loaded;
}

export function buildDebugStateSnapshot(options = {}) {
  const snapshot = getGameState();
  const availableFlagKeys = Object.keys(snapshot.storyFlags);
  const preferredFlagKeys = Array.isArray(options.storyFlagKeys)
    ? options.storyFlagKeys.filter((flagKey) => typeof flagKey === "string" && flagKey.trim())
    : [];
  const selectedFlagKeys = preferredFlagKeys.length > 0 ? preferredFlagKeys : availableFlagKeys.slice(0, 8);

  const selectedStoryFlags = selectedFlagKeys.reduce((acc, flagKey) => {
    acc[flagKey] = snapshot.storyFlags[flagKey];
    return acc;
  }, {});

  return {
    party: snapshot.party.members.map((member) => ({
      id: member.id,
      name: member.name,
      level: member.level,
      currentXP: member.currentXP,
      xpToNextLevel: member.xpToNextLevel,
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      isDrone: member.flags?.isDrone === true,
    })),
    inventory: { ...snapshot.inventory.items },
    storyFlags: selectedStoryFlags,
  };
}

export function logDebugStateSnapshot(options = {}) {
  const debugSnapshot = buildDebugStateSnapshot(options);
  console.log("[Debug State Snapshot]", debugSnapshot);
  return debugSnapshot;
}
