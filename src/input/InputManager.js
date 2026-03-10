import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

export const InputActions = Object.freeze({
  MOVE_UP: "MOVE_UP",
  MOVE_DOWN: "MOVE_DOWN",
  MOVE_LEFT: "MOVE_LEFT",
  MOVE_RIGHT: "MOVE_RIGHT",
  CONFIRM: "CONFIRM",
  CANCEL: "CANCEL",
  SELECT_TILE: "SELECT_TILE",
});

const DEFAULT_KEY_BINDINGS = Object.freeze({
  [InputActions.MOVE_UP]: ["UP", "W"],
  [InputActions.MOVE_DOWN]: ["DOWN", "S"],
  [InputActions.MOVE_LEFT]: ["LEFT", "A"],
  [InputActions.MOVE_RIGHT]: ["RIGHT", "D"],
  [InputActions.CONFIRM]: ["ENTER", "SPACE"],
  [InputActions.CANCEL]: ["ESC"],
});

const ACTIONS_WITH_STATE = new Set([
  InputActions.MOVE_UP,
  InputActions.MOVE_DOWN,
  InputActions.MOVE_LEFT,
  InputActions.MOVE_RIGHT,
]);

function createTileResolver(options) {
  if (typeof options.worldToTile === "function") {
    return options.worldToTile;
  }

  const tileSize = options.tileSize;
  if (typeof tileSize === "number" && tileSize > 0) {
    return (worldX, worldY) => ({
      tileX: Math.floor(worldX / tileSize),
      tileY: Math.floor(worldY / tileSize),
    });
  }

  if (
    tileSize &&
    typeof tileSize.width === "number" &&
    typeof tileSize.height === "number" &&
    tileSize.width > 0 &&
    tileSize.height > 0
  ) {
    return (worldX, worldY) => ({
      tileX: Math.floor(worldX / tileSize.width),
      tileY: Math.floor(worldY / tileSize.height),
    });
  }

  return null;
}

class InputManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.callbacks = new Set();
    this.keyBindings = {};
    this.keysByAction = new Map();
    this.keyListenerRecords = [];
    this.pointerListener = null;
    this.pressedKeysByAction = new Map();
    this.enabledActions = new Set(Object.values(InputActions));
    this.tileResolver = createTileResolver(options);
    this.pointerEnabled = options.pointerEnabled !== false;
    this.keyboardEnabled = options.keyboardEnabled !== false;

    this.configureBindings(options.keyBindings ?? DEFAULT_KEY_BINDINGS);
    this.attach();

    if (options.autoCleanup !== false) {
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
      scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    }
  }

  attach() {
    this.destroyKeyboardBindings();

    if (this.keyboardEnabled) {
      this.bindKeyboardActions();
    }

    if (this.pointerEnabled) {
      this.bindPointerActions();
    }
  }

  configureBindings(bindings) {
    Object.values(InputActions).forEach((action) => {
      const configured = bindings?.[action];
      if (!Array.isArray(configured)) {
        this.keyBindings[action] = [];
        return;
      }
      this.keyBindings[action] = [...new Set(configured)];
    });
  }

  bindKeyboardActions() {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }

    Object.entries(this.keyBindings).forEach(([action, keyNames]) => {
      const actionKeys = [];
      const pressedSet = this.pressedKeysByAction.get(action) ?? new Set();
      this.pressedKeysByAction.set(action, pressedSet);

      keyNames.forEach((keyName) => {
        const key = keyboard.addKey(keyName);
        actionKeys.push(key);

        const downHandler = () => {
          if (!this.enabledActions.has(action)) {
            return;
          }
          pressedSet.add(key.keyCode);
          this.emitAction(action, {
            type: "pressed",
            source: "keyboard",
            key: key.event?.key ?? keyName,
            keyCode: key.keyCode,
          });
        };

        const upHandler = () => {
          pressedSet.delete(key.keyCode);
          if (!this.enabledActions.has(action)) {
            return;
          }
          this.emitAction(action, {
            type: "released",
            source: "keyboard",
            key: key.event?.key ?? keyName,
            keyCode: key.keyCode,
          });
        };

        key.on("down", downHandler);
        key.on("up", upHandler);
        this.keyListenerRecords.push({ key, downHandler, upHandler });
      });

      this.keysByAction.set(action, actionKeys);
    });
  }

  bindPointerActions() {
    if (this.pointerListener) {
      this.scene.input.off("pointerdown", this.pointerListener);
    }

    this.pointerListener = (pointer) => {
      if (!this.enabledActions.has(InputActions.SELECT_TILE)) {
        return;
      }

      const tile = this.tileResolver
        ? this.tileResolver(pointer.worldX, pointer.worldY, pointer)
        : { tileX: null, tileY: null };

      this.emitAction(InputActions.SELECT_TILE, {
        type: "pressed",
        source: pointer.wasTouch || pointer.pointerType === "touch" ? "touch" : "mouse",
        tileX: tile?.tileX ?? null,
        tileY: tile?.tileY ?? null,
      });
    };

    this.scene.input.on("pointerdown", this.pointerListener);
  }

  emitAction(action, payload = {}) {
    if (!this.enabledActions.has(action)) {
      return;
    }

    const event = {
      action,
      ...payload,
      timestamp: this.scene.time.now,
    };

    this.callbacks.forEach((callback) => callback(event));
  }

  onAction(callback) {
    this.callbacks.add(callback);
    return () => this.offAction(callback);
  }

  offAction(callback) {
    this.callbacks.delete(callback);
  }

  isActionActive(action) {
    const activeKeys = this.pressedKeysByAction.get(action);
    return Boolean(activeKeys && activeKeys.size > 0);
  }

  getAxisVector() {
    const horizontal =
      Number(this.isActionActive(InputActions.MOVE_RIGHT)) -
      Number(this.isActionActive(InputActions.MOVE_LEFT));
    const vertical =
      Number(this.isActionActive(InputActions.MOVE_DOWN)) -
      Number(this.isActionActive(InputActions.MOVE_UP));

    return { x: horizontal, y: vertical };
  }

  setActionEnabled(action, enabled) {
    if (enabled) {
      this.enabledActions.add(action);
      return;
    }

    this.enabledActions.delete(action);
    const pressed = this.pressedKeysByAction.get(action);
    if (pressed) {
      pressed.clear();
    }
  }

  rebindAction(action, keyNames = []) {
    const nextBindings = {
      ...this.keyBindings,
      [action]: Array.isArray(keyNames) ? [...keyNames] : [],
    };

    this.destroyKeyboardBindings();
    this.configureBindings(nextBindings);
    if (this.keyboardEnabled) {
      this.bindKeyboardActions();
    }
  }

  unbindAction(action) {
    this.rebindAction(action, []);
  }

  destroyKeyboardBindings() {
    this.keyListenerRecords.forEach(({ key, downHandler, upHandler }) => {
      key.off("down", downHandler);
      key.off("up", upHandler);
    });

    this.keyListenerRecords = [];
    this.keysByAction.clear();

    ACTIONS_WITH_STATE.forEach((action) => {
      const pressed = this.pressedKeysByAction.get(action);
      if (pressed) {
        pressed.clear();
      }
    });
  }

  destroy() {
    if (!this.scene) {
      return;
    }

    if (this.pointerListener) {
      this.scene.input.off("pointerdown", this.pointerListener);
      this.pointerListener = null;
    }

    this.destroyKeyboardBindings();
    this.callbacks.clear();
    this.scene = null;
  }
}

export default InputManager;
