import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import gameConfig from "./gameConfig.js";
import { normalizePlayerProgressState } from "./state/playerProgress.js";
import { loadProgress, saveProgress } from "./persistence/saveSystem.js";
import {
  applyCanvasInteractionGuards,
  installVisibilityPauseGuard,
  resolveDevicePixelRatio,
} from "./platform/browserCompat.js";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Missing #app container for Phaser game.");
}

app.replaceChildren();
const hydratedProgress = loadProgress();
const existingPreBoot = gameConfig.callbacks?.preBoot;
let teardownVisibilityPauseGuard = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    teardownVisibilityPauseGuard?.();
    teardownVisibilityPauseGuard = null;
  });
}

gameConfig.callbacks = {
  ...(gameConfig.callbacks ?? {}),
  preBoot: (game) => {
    game.config.resolution = resolveDevicePixelRatio(2);
    game.registry.set("playerProgress", hydratedProgress);
    game.registry.set("setPlayerProgress", (nextState) => {
      const normalized = normalizePlayerProgressState(nextState);
      game.registry.set("playerProgress", normalized);
      saveProgress(normalized);
      return normalized;
    });
    applyCanvasInteractionGuards(game);
    teardownVisibilityPauseGuard?.();
    teardownVisibilityPauseGuard = installVisibilityPauseGuard(game);

    existingPreBoot?.(game);
  },
};

// eslint-disable-next-line no-new
new Phaser.Game(gameConfig);
