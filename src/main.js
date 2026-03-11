import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import gameConfig from "./gameConfig.js";
import AudioManager from "./audio/AudioManager.js";
import { normalizePlayerProgressState } from "./state/playerProgress.js";
import { saveProgress } from "./persistence/saveSystem.js";
import { hydrateGameStateFromProgress } from "./state/gameState.js";
import { buildDebugStateSnapshot, loadGame, saveGame } from "./persistence/runtimeStateTools.js";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Missing #app container for Phaser game.");
}

app.replaceChildren();
const hydratedProgress = loadGame(null);
const existingPreBoot = gameConfig.callbacks?.preBoot;

gameConfig.callbacks = {
  ...(gameConfig.callbacks ?? {}),
  preBoot: (game) => {
    const audioManager = new AudioManager(game);
    game.registry.set("playerProgress", hydratedProgress);
    game.registry.set("audioManager", audioManager);
    game.registry.set("setPlayerProgress", (nextState) => {
      const normalized = normalizePlayerProgressState(nextState);
      game.registry.set("playerProgress", normalized);
      hydrateGameStateFromProgress(normalized);
      saveProgress(normalized);
      return normalized;
    });
    game.registry.set("setAudioVolume", (levels = {}) => audioManager.setVolume(levels));
    game.registry.set("getAudioVolume", () => audioManager.getVolume());
    game.registry.set("saveGame", (options = {}) => saveGame(game, options));
    game.registry.set("loadGame", () => loadGame(game));
    game.registry.set("debugGameState", (options = {}) => buildDebugStateSnapshot(options));

    existingPreBoot?.(game);
  },
};

// eslint-disable-next-line no-new
new Phaser.Game(gameConfig);
