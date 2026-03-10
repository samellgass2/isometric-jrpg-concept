import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import OverworldScene from "./scenes/OverworldScene.js";
import BattleScene from "./scenes/BattleScene.js";

const gameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "app",
  backgroundColor: "#101218",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [OverworldScene, BattleScene],
};

export default gameConfig;
