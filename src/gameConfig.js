import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import OverworldScene from "./scenes/OverworldScene.js";

const gameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "app",
  backgroundColor: "#101218",
  pixelArt: true,
  scene: [OverworldScene],
};

export default gameConfig;
