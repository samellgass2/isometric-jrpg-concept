import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const DEFAULT_WIDTH = 250;
const DEFAULT_PADDING = 10;

class HUDOverlay {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.depth = options.depth ?? 60;
    this.panelWidth = options.width ?? DEFAULT_WIDTH;
    this.padding = options.padding ?? DEFAULT_PADDING;
    this.anchorX = options.x ?? (scene.scale?.width ?? 800) - 12;
    this.anchorY = options.y ?? 12;
    this.usesAutoAnchorX = options.x == null;

    this.background = null;
    this.contextText = null;
    this.primaryText = null;
    this.secondaryText = null;
    this.tertiaryText = null;

    this.lastPayload = null;
    this.resizeHandler = null;
  }

  create() {
    this.background = this.scene.add
      .rectangle(this.anchorX, this.anchorY, this.panelWidth, 96, 0x0f1622, 0.78)
      .setOrigin(1, 0)
      .setStrokeStyle(1, 0x93b6ee, 0.65)
      .setScrollFactor(0)
      .setDepth(this.depth);

    const textStyle = {
      color: "#e8f2ff",
      fontFamily: "monospace",
      fontSize: "12px",
    };

    this.contextText = this.scene.add
      .text(this.anchorX - this.padding, this.anchorY + 6, "", {
        ...textStyle,
        color: "#b9d4ff",
        fontSize: "11px",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    this.primaryText = this.scene.add
      .text(this.anchorX - this.padding, this.anchorY + 24, "", textStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    this.secondaryText = this.scene.add
      .text(this.anchorX - this.padding, this.anchorY + 42, "", textStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    this.tertiaryText = this.scene.add
      .text(this.anchorX - this.padding, this.anchorY + 60, "", {
        ...textStyle,
        color: "#c5d8ef",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    this.bindResizeListener();

    return this;
  }

  setData(payload = {}) {
    if (!this.background) {
      this.create();
    }

    const normalized = {
      context: payload.context ?? "",
      primary: payload.primary ?? "",
      secondary: payload.secondary ?? "",
      tertiary: payload.tertiary ?? "",
    };

    if (this.lastPayload && this.payloadEquals(normalized, this.lastPayload)) {
      return;
    }

    this.lastPayload = normalized;
    this.contextText.setText(normalized.context);
    this.primaryText.setText(normalized.primary);
    this.secondaryText.setText(normalized.secondary);
    this.tertiaryText.setText(normalized.tertiary);

    const visibleLines = [normalized.context, normalized.primary, normalized.secondary, normalized.tertiary].filter(
      (line) => Boolean(line)
    );
    const panelHeight = Math.max(48, 18 + visibleLines.length * 18 + this.padding);
    this.background.setSize(this.panelWidth, panelHeight);
  }

  payloadEquals(a, b) {
    return (
      a.context === b.context &&
      a.primary === b.primary &&
      a.secondary === b.secondary &&
      a.tertiary === b.tertiary
    );
  }

  bindResizeListener() {
    if (!this.usesAutoAnchorX || this.resizeHandler || !this.scene?.scale) {
      return;
    }

    this.resizeHandler = (gameSize) => {
      const width = gameSize?.width ?? this.scene.scale.width;
      this.anchorX = width - 12;
      this.repositionElements();
    };

    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
  }

  repositionElements() {
    if (!this.background) {
      return;
    }

    this.background.setPosition(this.anchorX, this.anchorY);
    this.contextText?.setPosition(this.anchorX - this.padding, this.anchorY + 6);
    this.primaryText?.setPosition(this.anchorX - this.padding, this.anchorY + 24);
    this.secondaryText?.setPosition(this.anchorX - this.padding, this.anchorY + 42);
    this.tertiaryText?.setPosition(this.anchorX - this.padding, this.anchorY + 60);
  }

  destroy() {
    if (this.resizeHandler && this.scene?.scale) {
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
      this.resizeHandler = null;
    }

    this.background?.destroy();
    this.contextText?.destroy();
    this.primaryText?.destroy();
    this.secondaryText?.destroy();
    this.tertiaryText?.destroy();
    this.background = null;
    this.contextText = null;
    this.primaryText = null;
    this.secondaryText = null;
    this.tertiaryText = null;
    this.lastPayload = null;
    this.scene = null;
  }
}

export default HUDOverlay;
