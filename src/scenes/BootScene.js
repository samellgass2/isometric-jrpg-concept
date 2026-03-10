import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import { ensureSharedTextures } from "../graphics/sharedTextures.js";
import { installAudioUnlockOnFirstGesture } from "../platform/browserCompat.js";

class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    ensureSharedTextures(this);
  }

  create() {
    installAudioUnlockOnFirstGesture(this);
    this.scene.start("MainMenuScene");
  }
}

export default BootScene;
