import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
    this.returnToOverworldKey = null;
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor("#243145");
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(400, 300);

    this.add.text(24, 20, "Battle Scene", {
      color: "#f4f7ff",
      fontFamily: "monospace",
      fontSize: "20px",
    });

    this.add.text(24, 48, "Debug scene active. Press O to return to Overworld.", {
      color: "#b5c7e8",
      fontFamily: "monospace",
      fontSize: "14px",
    });

    this.returnToOverworldKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
  }

  update() {
    if (this.returnToOverworldKey && Phaser.Input.Keyboard.JustDown(this.returnToOverworldKey)) {
      this.scene.start("OverworldScene");
    }
  }
}

export default BattleScene;
