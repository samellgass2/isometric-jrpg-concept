import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.startButton = null;
    this.startButtonLabel = null;
    this.startTriggered = false;
  }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;

    this.cameras.main.setBackgroundColor("#101822");

    this.add
      .text(centerX, 100, "Isometric Strategy Game", {
        color: "#f3f7ff",
        fontFamily: "monospace",
        fontSize: "40px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 150, "Prototype Main Menu", {
        color: "#95a9c8",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.startButton = this.add
      .rectangle(centerX, height / 2, 260, 64, 0x2f6fff, 0.95)
      .setStrokeStyle(3, 0xaec8ff, 1)
      .setInteractive({ useHandCursor: true });

    this.startButtonLabel = this.add
      .text(centerX, height / 2, "Start Game", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "24px",
      })
      .setOrigin(0.5);

    this.startButton.on("pointerover", () => {
      this.startButton.setFillStyle(0x3e7bff, 1);
      this.startButtonLabel.setColor("#f8fbff");
    });

    this.startButton.on("pointerout", () => {
      this.startButton.setFillStyle(0x2f6fff, 0.95);
      this.startButtonLabel.setColor("#ffffff");
    });

    this.startButton.on("pointerdown", () => this.startGame());

    this.input.keyboard.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());

    this.add
      .text(centerX, height / 2 + 80, "Press Enter / Space or click Start Game", {
        color: "#b8cae6",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 120, "Available Routes", {
        color: "#dce8ff",
        fontFamily: "monospace",
        fontSize: "18px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 88, "Level 1  -  Frontier Pass", {
        color: "#dce8ff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 62, "Level 2  -  Ironwood Outpost", {
        color: "#dce8ff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);
  }

  startGame() {
    if (this.startTriggered) {
      return;
    }

    this.startTriggered = true;
    const progress = this.game.registry.get("playerProgress");
    const resumeSceneKey =
      typeof progress?.overworld?.currentSceneKey === "string" &&
      progress.overworld.currentSceneKey.trim()
        ? progress.overworld.currentSceneKey
        : "OverworldScene";
    const resumeData =
      resumeSceneKey === "OverworldScene"
        ? { spawnPointId: progress?.overworld?.spawnPointId }
        : {};

    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => {
      this.scene.start(resumeSceneKey, resumeData);
    });
  }
}

export default MainMenuScene;
