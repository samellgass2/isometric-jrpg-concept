import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const DEFAULT_MAX_DPR = 2;

function asFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function resolveDevicePixelRatio(maxDpr = DEFAULT_MAX_DPR) {
  if (typeof window === "undefined") {
    return 1;
  }

  const raw = asFiniteNumber(window.devicePixelRatio, 1);
  const capped = Math.min(Math.max(raw, 1), Math.max(1, maxDpr));
  return Number.isFinite(capped) ? capped : 1;
}

export function getNormalizedPointerWorldPosition(scene, pointer) {
  if (!scene || !pointer) {
    return null;
  }

  const worldX = asFiniteNumber(pointer.worldX, null);
  const worldY = asFiniteNumber(pointer.worldY, null);
  if (worldX !== null && worldY !== null) {
    return { x: worldX, y: worldY };
  }

  const camera = scene.cameras?.main;
  if (!camera) {
    return null;
  }

  const screenX = asFiniteNumber(pointer.x, null);
  const screenY = asFiniteNumber(pointer.y, null);
  if (screenX === null || screenY === null) {
    return null;
  }

  const point = camera.getWorldPoint(screenX, screenY);
  if (!point) {
    return null;
  }

  return {
    x: asFiniteNumber(point.x, null),
    y: asFiniteNumber(point.y, null),
  };
}

export function shouldProcessPointerDown(pointer) {
  if (!pointer) {
    return false;
  }

  if (pointer.wasTouch || pointer.pointerType === "touch") {
    return true;
  }

  const event = pointer.event;
  const button = asFiniteNumber(event?.button, pointer.button);
  if (button !== null && button !== 0 && button !== -1) {
    return false;
  }

  if (event && "isPrimary" in event && event.isPrimary === false) {
    return false;
  }

  return true;
}

export function applyCanvasInteractionGuards(game) {
  const canvas = game?.canvas;
  const inputManager = game?.input;
  if (!canvas) {
    return;
  }

  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  canvas.style.webkitUserSelect = "none";
  canvas.style.webkitTapHighlightColor = "transparent";
  canvas.style.imageRendering = "pixelated";

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  if (inputManager?.mouse) {
    inputManager.mouse.disableContextMenu();
  }
}

export function installVisibilityPauseGuard(game) {
  if (typeof document === "undefined" || !game?.loop) {
    return () => {};
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      game.loop.sleep();
      return;
    }
    game.loop.wake();
  };

  const onWindowBlur = () => game.loop.sleep();
  const onWindowFocus = () => game.loop.wake();

  document.addEventListener("visibilitychange", onVisibilityChange);
  if (typeof window !== "undefined") {
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
    }
  };
}

export function installAudioUnlockOnFirstGesture(scene) {
  const input = scene?.input;
  const sound = scene?.sound;
  if (!input || !sound) {
    return;
  }

  const unlock = async () => {
    const context = sound.context;
    if (context?.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // Ignore: autoplay policy remains browser-controlled.
      }
    }

    if (typeof sound.unlock === "function") {
      sound.unlock();
    }
  };

  input.once(Phaser.Input.Events.POINTER_DOWN, unlock);
  input.keyboard?.once("keydown", unlock);
}
