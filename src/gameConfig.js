import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import BootScene from "./scenes/BootScene.js";
import MainMenuScene from "./scenes/MainMenuScene.js";
import OverworldScene from "./scenes/OverworldScene.js";
import BattleScene from "./scenes/BattleScene.js";
import Level1Scene from "./scenes/Level1Scene.js";
import Level2Scene from "./scenes/Level2Scene.js";
import { animalUnitList } from "./battle/units/animalUnits.js";
import { resolveDevicePixelRatio } from "./platform/browserCompat.js";

export const battleUnitCatalog = {
  animals: animalUnitList,
};

const gameConfig = {
  type: Phaser.WEBGL,
  width: 800,
  height: 600,
  parent: "app",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
    autoRound: true,
    expandParent: true,
  },
  resolution: resolveDevicePixelRatio(2),
  backgroundColor: "#101218",
  pixelArt: true,
  antialias: false,
  antialiasGL: false,
  powerPreference: "high-performance",
  roundPixels: true,
  render: {
    pixelArt: true,
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
    powerPreference: "high-performance",
    desynchronized: true,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
    smoothStep: false,
  },
  input: {
    activePointers: 3,
    keyboard: true,
    mouse: {
      preventDefaultDown: true,
      preventDefaultUp: true,
      preventDefaultMove: true,
      preventDefaultWheel: false,
    },
    touch: {
      capture: true,
    },
    gamepad: false,
    windowEvents: true,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, BattleScene, OverworldScene, Level1Scene, Level2Scene],
};

export default gameConfig;
