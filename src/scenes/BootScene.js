import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import { ensureSharedAssets } from "../render/sharedAssets.js";

class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.setPath("assets/");
  }

  create() {
    ensureSharedAssets(this);
    this.scene.start("MainMenuScene");
  }
}

export default BootScene;
