class BattleResultOverlay {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 120;
    this.width = options.width ?? 420;
    this.height = options.height ?? 140;

    this.root = null;
    this.dim = null;
    this.panel = null;
    this.titleText = null;
    this.subtitleText = null;

    this.activeTweens = new Set();
  }

  create() {
    if (this.root) {
      return this;
    }

    const { width, height } = this.scene.scale;
    this.root = this.scene.add.container(width / 2, height / 2).setScrollFactor(0).setDepth(this.depth);

    this.dim = this.scene.add
      .rectangle(0, 0, width, height, 0x05070a, 0.56)
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.panel = this.scene.add
      .rectangle(0, 0, this.width, this.height, 0x111e2d, 0.92)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x9bc2ff, 0.9);

    this.titleText = this.scene.add
      .text(0, -14, "", {
        color: "#f0f5ff",
        fontFamily: "monospace",
        fontSize: "30px",
      })
      .setOrigin(0.5);

    this.subtitleText = this.scene.add
      .text(0, 23, "", {
        color: "#d7e6ff",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setOrigin(0.5);

    this.root.add([this.dim, this.panel, this.titleText, this.subtitleText]);
    this.root.setVisible(false).setAlpha(0).setScale(0.94);
    return this;
  }

  show(payload = {}, options = {}) {
    this.create();
    this.stopTweens();

    const title = payload.title ?? "Complete";
    const subtitle = payload.subtitle ?? "Returning to overworld...";
    const panelColor = Number.isFinite(payload.panelColor) ? payload.panelColor : 0x111e2d;
    const borderColor = Number.isFinite(payload.borderColor) ? payload.borderColor : 0x9bc2ff;
    const titleColor = payload.titleColor ?? "#f0f5ff";

    const enterDuration = Math.max(60, Math.floor(Number(options.enterDuration) || 170));
    const holdDuration = Math.max(120, Math.floor(Number(options.holdDuration) || 330));
    const exitDuration = Math.max(60, Math.floor(Number(options.exitDuration) || 190));

    this.panel.setFillStyle(panelColor, 0.92).setStrokeStyle(2, borderColor, 0.9);
    this.titleText.setColor(titleColor).setText(title);
    this.subtitleText.setText(subtitle);

    this.root.setVisible(true).setAlpha(0).setScale(0.94);

    const tween = this.scene.tweens.chain({
      targets: this.root,
      tweens: [
        {
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: enterDuration,
          ease: "Sine.Out",
        },
        {
          duration: holdDuration,
        },
        {
          alpha: 0,
          scaleX: 1.03,
          scaleY: 1.03,
          duration: exitDuration,
          ease: "Quad.In",
        },
      ],
      onComplete: () => {
        this.root?.setVisible(false).setAlpha(0).setScale(0.94);
        options.onComplete?.();
      },
    });

    this.rememberTween(tween);
    return enterDuration + holdDuration + exitDuration;
  }

  hideImmediate() {
    if (!this.root) {
      return;
    }
    this.stopTweens();
    this.root.setVisible(false).setAlpha(0).setScale(0.94);
  }

  stopTweens() {
    this.activeTweens.forEach((tween) => {
      tween?.stop?.();
      tween?.remove?.();
    });
    this.activeTweens.clear();
  }

  rememberTween(tween) {
    if (!tween) {
      return;
    }
    this.activeTweens.add(tween);
    tween.once?.("complete", () => this.activeTweens.delete(tween));
    tween.once?.("stop", () => this.activeTweens.delete(tween));
  }

  destroy() {
    this.stopTweens();
    this.titleText?.destroy();
    this.subtitleText?.destroy();
    this.panel?.destroy();
    this.dim?.destroy();
    this.root?.destroy();

    this.root = null;
    this.dim = null;
    this.panel = null;
    this.titleText = null;
    this.subtitleText = null;
  }
}

export default BattleResultOverlay;
