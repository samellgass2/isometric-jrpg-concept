import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import {
  applyKeyboardCapture,
  createFocusVisibilityResetHook,
  getPointerInputSource,
  getPointerWorldPosition,
  normalizePointerScreenPosition,
} from "../platform/browserCompat.js";

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
    this.pendingEvents = [];
    this.tileResolver = createTileResolver(options);
    this.pointerEnabled = options.pointerEnabled !== false;
    this.keyboardEnabled = options.keyboardEnabled !== false;
    this.detachFocusVisibilityHook = null;

    this.configureBindings(options.keyBindings ?? DEFAULT_KEY_BINDINGS);
    this.attach();

    if (options.autoCleanup !== false) {
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
      scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    }
  }

  attach() {
    if (this.keyboardEnabled) {
      this.bindKeyboardActions();
    }

    if (this.pointerEnabled) {
      this.bindPointerActions();
    }

    this.detachFocusVisibilityHook = createFocusVisibilityResetHook(() => this.resetPressedState());
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

    const captureKeys = new Set();
    Object.entries(this.keyBindings).forEach(([action, keyNames]) => {
      const actionKeys = [];
      const pressedSet = this.pressedKeysByAction.get(action) ?? new Set();
      this.pressedKeysByAction.set(action, pressedSet);

      keyNames.forEach((keyName) => {
        captureKeys.add(keyName);
        const key = keyboard.addKey(keyName);
        actionKeys.push(key);
        const keyIdentity = Number.isFinite(key.keyCode) ? key.keyCode : keyName;

        const downHandler = () => {
          if (!this.enabledActions.has(action)) {
            return;
          }

          if (pressedSet.has(keyIdentity)) {
            return;
          }
          pressedSet.add(keyIdentity);
          this.emitAction(action, {
            type: "pressed",
            source: "keyboard",
            key: key.event?.key ?? keyName,
            keyCode: key.keyCode,
          });
        };

        const upHandler = () => {
          pressedSet.delete(keyIdentity);
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

    applyKeyboardCapture(keyboard, [...captureKeys]);
  }

  bindPointerActions() {
    this.pointerListener = (pointer) => {
      if (!this.enabledActions.has(InputActions.SELECT_TILE)) {
        return;
      }

      const worldPoint = getPointerWorldPosition(this.scene, pointer);
      if (!worldPoint) {
        return;
      }

      const tile = this.tileResolver
        ? this.tileResolver(worldPoint.x, worldPoint.y, pointer)
        : { tileX: null, tileY: null };

      const viewportWidth = this.scene.scale?.width ?? 1;
      const viewportHeight = this.scene.scale?.height ?? 1;
      const screenPosition = normalizePointerScreenPosition(pointer);

      this.emitAction(InputActions.SELECT_TILE, {
        type: "pressed",
        source: getPointerInputSource(pointer),
        pointer,
        worldX: worldPoint.x,
        worldY: worldPoint.y,
        screenX: screenPosition.x,
        screenY: screenPosition.y,
        normalizedX: Phaser.Math.Clamp(screenPosition.x / viewportWidth, 0, 1),
        normalizedY: Phaser.Math.Clamp(screenPosition.y / viewportHeight, 0, 1),
        tileX: tile?.tileX ?? null,
        tileY: tile?.tileY ?? null,
      });
    };

    this.scene.input.on("pointerdown", this.pointerListener);
  }

  resetPressedState() {
    this.scene?.input?.keyboard?.resetKeys?.();
    this.pressedKeysByAction.forEach((pressedSet) => {
      pressedSet.clear();
    });
    this.pendingEvents.length = 0;
  }

  emitAction(action, payload = {}) {
    if (!this.enabledActions.has(action)) {
      return;
    }

    this.pendingEvents.push({
      action,
      ...payload,
      timestamp: this.scene.time.now,
    });
  }

  flushPendingActions() {
    if (!this.pendingEvents.length || this.callbacks.size === 0) {
      this.pendingEvents.length = 0;
      return 0;
    }

    const queued = this.pendingEvents;
    const eventCount = queued.length;
    this.pendingEvents = [];
    queued.forEach((event) => {
      this.callbacks.forEach((callback) => callback(event));
    });
    return eventCount;
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

    if (this.detachFocusVisibilityHook) {
      this.detachFocusVisibilityHook();
      this.detachFocusVisibilityHook = null;
    }

    this.destroyKeyboardBindings();
    this.pendingEvents.length = 0;
    this.callbacks.clear();
    this.scene = null;
  }
}

export default InputManager;
