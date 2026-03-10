import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import { applyKeyboardCapture } from "../platform/browserCompat.js";

class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.startButton = null;
    this.startButtonLabel = null;
    this.droneTestButton = null;
    this.droneTestButtonLabel = null;
    this.startTriggered = false;
    this.onEnterKeyDown = null;
    this.onSpaceKeyDown = null;
    this.onDroneTestKeyDown = null;
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

    const createMenuButton = ({ y, label, fillColor, strokeColor, hoverColor, textColor = "#ffffff", onClick }) => {
      const button = this.add
        .rectangle(centerX, y, 300, 58, fillColor, 0.95)
        .setStrokeStyle(3, strokeColor, 1)
        .setInteractive({ useHandCursor: true });

      const buttonLabel = this.add
        .text(centerX, y, label, {
          color: textColor,
          fontFamily: "monospace",
          fontSize: "21px",
        })
        .setOrigin(0.5);

      button.on("pointerover", () => {
        button.setFillStyle(hoverColor, 1);
        buttonLabel.setColor("#f8fbff");
      });

      button.on("pointerout", () => {
        button.setFillStyle(fillColor, 0.95);
        buttonLabel.setColor(textColor);
      });

      button.on("pointerdown", onClick);

      return { button, buttonLabel };
    };

    const mainStart = createMenuButton({
      y: height / 2 - 8,
      label: "Start Game",
      fillColor: 0x2f6fff,
      strokeColor: 0xaec8ff,
      hoverColor: 0x3e7bff,
      onClick: () => this.startGame(),
    });
    this.startButton = mainStart.button;
    this.startButtonLabel = mainStart.buttonLabel;

    const droneTestStart = createMenuButton({
      y: height / 2 + 72,
      label: "Drone Test Battle",
      fillColor: 0x7a3240,
      strokeColor: 0xffb4c4,
      hoverColor: 0x8f3c4d,
      onClick: () => this.startDroneTestBattle(),
    });
    this.droneTestButton = droneTestStart.button;
    this.droneTestButtonLabel = droneTestStart.buttonLabel;

    this.setupKeyboardInput();

    this.add
      .text(centerX, height / 2 + 114, "Press Enter/Space to Start Game or T for Drone Test Battle", {
        color: "#b8cae6",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 138, "Available Routes", {
        color: "#dce8ff",
        fontFamily: "monospace",
        fontSize: "18px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 108, "Level 1  -  Frontier Pass", {
        color: "#dce8ff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 84, "Level 2  -  Ironwood Outpost", {
        color: "#dce8ff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height - 58, "Debug  -  Drone Test Battle", {
        color: "#ffd2dc",
        fontFamily: "monospace",
        fontSize: "15px",
      })
      .setOrigin(0.5);
  }

  setupKeyboardInput() {
    this.teardownKeyboardInput();
    if (!this.input.keyboard) {
      return;
    }

    applyKeyboardCapture(this.input.keyboard);
    this.onEnterKeyDown = () => this.startGame();
    this.onSpaceKeyDown = () => this.startGame();
    this.onDroneTestKeyDown = () => this.startDroneTestBattle();
    this.input.keyboard.on("keydown-ENTER", this.onEnterKeyDown);
    this.input.keyboard.on("keydown-SPACE", this.onSpaceKeyDown);
    this.input.keyboard.on("keydown-T", this.onDroneTestKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownKeyboardInput());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownKeyboardInput());
  }

  teardownKeyboardInput() {
    if (this.onEnterKeyDown) {
      this.input.keyboard.off("keydown-ENTER", this.onEnterKeyDown);
      this.onEnterKeyDown = null;
    }
    if (this.onSpaceKeyDown) {
      this.input.keyboard.off("keydown-SPACE", this.onSpaceKeyDown);
      this.onSpaceKeyDown = null;
    }
    if (this.onDroneTestKeyDown) {
      this.input.keyboard.off("keydown-T", this.onDroneTestKeyDown);
      this.onDroneTestKeyDown = null;
    }
  }

  startDroneTestBattle() {
    if (this.startTriggered) {
      return;
    }

    this.startTriggered = true;
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.time.delayedCall(170, () => {
      this.scene.start("BattleScene", {
        encounterId: "drone-test-battle",
        returnSceneKey: "MainMenuScene",
      });
    });
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
