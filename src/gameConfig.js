import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import OverworldScene from "./scenes/OverworldScene.js";
import { animalUnitList } from "./battle/units/animalUnits.js";

export const battleUnitCatalog = {
  animals: animalUnitList,
};

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
  scene: [OverworldScene],
};

export default gameConfig;
