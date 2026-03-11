import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const DEFAULT_STYLE = Object.freeze({
  backgroundColor: 0x111827,
  borderColor: 0x7ea8ff,
  nameplateColor: 0x20324f,
  speakerColor: "#d8e8ff",
  bodyColor: "#ffffff",
  choiceColor: "#dbe9ff",
  selectedChoiceColor: "#ffe6a8",
  hintColor: "#b5c9ea",
  fontFamily: "monospace",
});

class DialogueOverlay {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.depth = options.depth ?? 45;
    this.width = options.width ?? 760;
    this.height = options.height ?? 148;
    this.centerX = options.x ?? (scene.scale?.width ?? 800) / 2;
    this.bottomY = options.y ?? (scene.scale?.height ?? 600) - 22;
    this.padding = options.padding ?? 12;
    this.portraitSize = options.portraitSize ?? 56;
    this.maxChoices = options.maxChoices ?? 4;
    this.style = { ...DEFAULT_STYLE, ...(options.style ?? {}) };

    this.root = null;
    this.background = null;
    this.nameplate = null;
    this.speakerText = null;
    this.bodyText = null;
    this.choiceTexts = [];
    this.hintText = null;
    this.portraitFrame = null;
    this.portraitImage = null;

    this.choiceClickHandler = null;
    this.currentState = {
      mode: "hidden",
      selectedChoiceIndex: 0,
      choices: [],
      choiceLineLength: 0,
      awaitingSignConfirm: false,
      activeSignId: null,
      activeNpcId: null,
    };
  }

  create() {
    if (this.root) {
      return this;
    }

    const topY = this.bottomY - this.height;
    const leftX = this.centerX - this.width / 2;
    const portraitX = leftX + this.padding + this.portraitSize / 2;
    const textLeftX = portraitX + this.portraitSize / 2 + 10;

    this.root = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(this.depth).setVisible(false);

    this.background = this.scene.add
      .rectangle(this.centerX, this.bottomY - this.height / 2, this.width, this.height, this.style.backgroundColor, 0.92)
      .setStrokeStyle(2, this.style.borderColor, 1);

    this.nameplate = this.scene.add
      .rectangle(textLeftX + 86, topY + 14, 172, 20, this.style.nameplateColor, 1)
      .setStrokeStyle(1, this.style.borderColor, 0.65);

    this.speakerText = this.scene.add.text(textLeftX + 6, topY + 5, "", {
      color: this.style.speakerColor,
      fontFamily: this.style.fontFamily,
      fontSize: "13px",
    });

    this.portraitFrame = this.scene.add
      .rectangle(portraitX, topY + this.padding + this.portraitSize / 2, this.portraitSize, this.portraitSize, 0x0f1622, 1)
      .setStrokeStyle(1, this.style.borderColor, 0.85);

    this.portraitImage = this.scene.add
      .image(portraitX, topY + this.padding + this.portraitSize / 2, "__MISSING")
      .setVisible(false);

    this.bodyText = this.scene.add.text(textLeftX, topY + 28, "", {
      color: this.style.bodyColor,
      fontFamily: this.style.fontFamily,
      fontSize: "14px",
      wordWrap: { width: this.width - (textLeftX - leftX) - this.padding, useAdvancedWrap: true },
    });

    const choiceStartY = topY + 80;
    for (let index = 0; index < this.maxChoices; index += 1) {
      const choiceText = this.scene.add
        .text(textLeftX, choiceStartY + index * 18, "", {
          color: this.style.choiceColor,
          fontFamily: this.style.fontFamily,
          fontSize: "13px",
        })
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (pointer, localX, localY, event) => {
          event?.stopPropagation?.();
          if (!this.currentState.choices[index]) {
            return;
          }
          this.choiceClickHandler?.({
            choice: this.currentState.choices[index],
            index,
          });
        });
      this.choiceTexts.push(choiceText);
    }

    this.hintText = this.scene.add.text(textLeftX, this.bottomY - 22, "", {
      color: this.style.hintColor,
      fontFamily: this.style.fontFamily,
      fontSize: "12px",
    });

    this.root.add([
      this.background,
      this.nameplate,
      this.speakerText,
      this.portraitFrame,
      this.portraitImage,
      this.bodyText,
      ...this.choiceTexts,
      this.hintText,
    ]);

    return this;
  }

  onChoiceSelected(handler) {
    this.choiceClickHandler = typeof handler === "function" ? handler : null;
    return this;
  }

  isVisible() {
    return Boolean(this.root?.visible);
  }

  isNpcConversationActive() {
    return this.currentState.mode === "npc" && Boolean(this.currentState.activeNpcId);
  }

  isAwaitingSignConfirm(signId = null) {
    if (!this.currentState.awaitingSignConfirm) {
      return false;
    }
    if (!signId) {
      return true;
    }
    return this.currentState.activeSignId === signId;
  }

  getSelectedChoice() {
    const selected = this.currentState.choices[this.currentState.selectedChoiceIndex];
    return selected ?? null;
  }

  hasChoices() {
    return this.currentState.choices.length > 0;
  }

  getActiveNpcId() {
    return this.currentState.activeNpcId;
  }

  getActiveSignId() {
    return this.currentState.activeSignId;
  }

  renderNpcSnapshot(snapshot, options = {}) {
    if (!snapshot?.node) {
      return;
    }
    this.create();

    const speakerName = snapshot.speaker?.name || snapshot.node.speakerId || "NPC";
    const speakerPortrait = snapshot.speaker?.portraitKey || null;
    const choices = Array.isArray(snapshot.choices) ? snapshot.choices.filter(Boolean) : [];
    const selectedChoiceIndex = Number.isInteger(options.selectedChoiceIndex)
      ? Phaser.Math.Clamp(options.selectedChoiceIndex, 0, Math.max(choices.length - 1, 0))
      : 0;

    this.currentState = {
      mode: "npc",
      selectedChoiceIndex,
      choices,
      choiceLineLength: choices.length,
      awaitingSignConfirm: false,
      activeSignId: null,
      activeNpcId: snapshot.npcId ?? options.npcId ?? null,
    };

    this.speakerText.setText(speakerName);
    this.bodyText.setText(snapshot.node.text ?? "");
    this.hintText.setText(
      choices.length > 0
        ? "Up/Down: choose  Enter/Space: confirm  Click: choose  Esc: back/close"
        : "Enter/Space: next  Esc: back/close"
    );
    this.renderPortraitTexture(speakerPortrait);
    this.renderChoices();
    this.show();
  }

  renderSystemMessage(message, options = {}) {
    this.create();

    this.currentState = {
      mode: "system",
      selectedChoiceIndex: 0,
      choices: [],
      choiceLineLength: 0,
      awaitingSignConfirm: false,
      activeSignId: null,
      activeNpcId: null,
    };

    this.speakerText.setText(options.speakerName ?? "System");
    this.bodyText.setText(message ?? "");
    this.hintText.setText(options.hintText ?? "Press Space, Enter, or Esc to close");
    this.renderPortraitTexture(options.portraitKey ?? null);
    this.renderChoices();
    this.show();
  }

  renderSignPrompt(payload = {}) {
    this.create();

    const signLabel = payload.signLabel ?? "Unknown Level";
    const signPrompt = payload.signPrompt ?? signLabel;
    const signId = payload.signId ?? null;

    this.currentState = {
      mode: "sign",
      selectedChoiceIndex: 0,
      choices: [],
      choiceLineLength: 0,
      awaitingSignConfirm: true,
      activeSignId: signId,
      activeNpcId: null,
    };

    this.speakerText.setText("Route Marker");
    this.bodyText.setText(
      `${signPrompt}\nPress Enter to travel to ${signLabel}. Tap/click the sign tile again to confirm.`
    );
    this.hintText.setText("Enter or sign-tile tap: travel  Space/Esc: close");
    this.renderPortraitTexture(payload.portraitKey ?? null);
    this.renderChoices();
    this.show();
  }

  moveChoiceSelection(direction) {
    if (this.currentState.choices.length === 0) {
      return this.currentState.selectedChoiceIndex;
    }

    const count = this.currentState.choices.length;
    const nextIndex = Phaser.Math.Wrap(this.currentState.selectedChoiceIndex + direction, 0, count);
    this.currentState.selectedChoiceIndex = nextIndex;
    this.renderChoices();
    return nextIndex;
  }

  hide() {
    if (!this.root) {
      return;
    }
    this.root.setVisible(false);
    this.currentState = {
      mode: "hidden",
      selectedChoiceIndex: 0,
      choices: [],
      choiceLineLength: 0,
      awaitingSignConfirm: false,
      activeSignId: null,
      activeNpcId: null,
    };
  }

  show() {
    this.root?.setVisible(true);
  }

  renderChoices() {
    const hasChoices = this.currentState.choices.length > 0;
    this.choiceTexts.forEach((choiceText, index) => {
      const choice = this.currentState.choices[index];
      if (!choice) {
        choiceText.setVisible(false);
        choiceText.setText("");
        choiceText.disableInteractive();
        return;
      }

      const isSelected = index === this.currentState.selectedChoiceIndex;
      const prefix = isSelected ? ">" : " ";
      choiceText
        .setText(`${prefix} ${index + 1}. ${choice.text ?? choice.id ?? "Choice"}`)
        .setColor(isSelected ? this.style.selectedChoiceColor : this.style.choiceColor)
        .setVisible(true);
      if (hasChoices) {
        choiceText.setInteractive({ useHandCursor: true });
      }
    });
  }

  renderPortraitTexture(textureKey) {
    const key = typeof textureKey === "string" ? textureKey : "";
    if (!key || !this.scene.textures.exists(key)) {
      this.portraitImage.setVisible(false);
      this.portraitFrame.setVisible(false);
      return;
    }

    this.portraitImage
      .setTexture(key)
      .setDisplaySize(this.portraitSize - 4, this.portraitSize - 4)
      .setVisible(true);
    this.portraitFrame.setVisible(true);
  }

  destroy() {
    this.choiceTexts.forEach((choiceText) => choiceText.destroy());
    this.choiceTexts = [];
    this.background?.destroy();
    this.nameplate?.destroy();
    this.speakerText?.destroy();
    this.bodyText?.destroy();
    this.hintText?.destroy();
    this.portraitFrame?.destroy();
    this.portraitImage?.destroy();
    this.root?.destroy();
    this.root = null;
    this.background = null;
    this.nameplate = null;
    this.speakerText = null;
    this.bodyText = null;
    this.hintText = null;
    this.portraitFrame = null;
    this.portraitImage = null;
    this.choiceClickHandler = null;
    this.currentState = {
      mode: "hidden",
      selectedChoiceIndex: 0,
      choices: [],
      choiceLineLength: 0,
      awaitingSignConfirm: false,
      activeSignId: null,
      activeNpcId: null,
    };
  }
}

export default DialogueOverlay;
