import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import MainMenuScene from "./scenes/MainMenuScene.js";
import OverworldScene from "./scenes/OverworldScene.js";
import BattleScene from "./scenes/BattleScene.js";
import Level1Scene from "./scenes/Level1Scene.js";
import Level2Scene from "./scenes/Level2Scene.js";
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
  scene: [MainMenuScene, BattleScene, OverworldScene, Level1Scene, Level2Scene],
};

export default gameConfig;
