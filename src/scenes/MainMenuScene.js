import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import { logDebugStateSnapshot, resolveResumeTarget } from "../persistence/runtimeStateTools.js";

class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.startButton = null;
    this.startButtonLabel = null;
    this.continueButton = null;
    this.continueButtonLabel = null;
    this.droneTestButton = null;
    this.droneTestButtonLabel = null;
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
      y: height / 2 - 48,
      label: "Start Game",
      fillColor: 0x2f6fff,
      strokeColor: 0xaec8ff,
      hoverColor: 0x3e7bff,
      onClick: () => this.startGame(),
    });
    this.startButton = mainStart.button;
    this.startButtonLabel = mainStart.buttonLabel;

    const continueGame = createMenuButton({
      y: height / 2 + 24,
      label: "Load Save / Continue",
      fillColor: 0x2f7d5f,
      strokeColor: 0xbaf6df,
      hoverColor: 0x34976f,
      onClick: () => this.continueGame(),
    });
    this.continueButton = continueGame.button;
    this.continueButtonLabel = continueGame.buttonLabel;

    const droneTestStart = createMenuButton({
      y: height / 2 + 96,
      label: "Drone Test Battle",
      fillColor: 0x7a3240,
      strokeColor: 0xffb4c4,
      hoverColor: 0x8f3c4d,
      onClick: () => this.startDroneTestBattle(),
    });
    this.droneTestButton = droneTestStart.button;
    this.droneTestButtonLabel = droneTestStart.buttonLabel;

    this.input.keyboard.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());
    this.input.keyboard.on("keydown-L", () => this.continueGame());
    this.input.keyboard.on("keydown-T", () => this.startDroneTestBattle());
    this.input.keyboard.on("keydown-I", () => this.logDebugState());
    this.input.keyboard.on("keydown-F6", (event) => {
      event?.preventDefault?.();
      this.saveFromMenu();
    });
    this.input.keyboard.on("keydown-F9", (event) => {
      event?.preventDefault?.();
      this.continueGame();
    });

    this.add
      .text(
        centerX,
        height / 2 + 146,
        "Enter/Space: Start  L/F9: Load Save  F6: Save  I: Dump Debug  T: Drone Test",
        {
        color: "#b8cae6",
        fontFamily: "monospace",
        fontSize: "13px",
        }
      )
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
    const { resumeSceneKey, resumeData } = resolveResumeTarget(progress);

    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => {
      this.scene.start(resumeSceneKey, resumeData);
    });
  }

  continueGame() {
    if (this.startTriggered) {
      return;
    }

    const loadGame = this.game.registry.get("loadGame");
    const progress = typeof loadGame === "function" ? loadGame() : this.game.registry.get("playerProgress");
    const { resumeSceneKey, resumeData } = resolveResumeTarget(progress);
    this.startTriggered = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => {
      this.scene.start(resumeSceneKey, resumeData);
    });
  }

  saveFromMenu() {
    const saveGame = this.game.registry.get("saveGame");
    if (typeof saveGame !== "function") {
      return;
    }
    const saved = saveGame({ currentSceneKey: this.scene.key });
    console.log("[MainMenuScene] Manual save complete.", {
      scene: saved?.overworld?.currentSceneKey,
      spawnPointId: saved?.overworld?.spawnPointId,
    });
  }

  logDebugState() {
    const getDebugState = this.game.registry.get("debugGameState");
    if (typeof getDebugState === "function") {
      console.log("[MainMenuScene] Debug snapshot", getDebugState());
      return;
    }
    logDebugStateSnapshot();
  }
}

export default MainMenuScene;
