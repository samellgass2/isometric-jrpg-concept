const DEFAULT_MAX_DPR = 2;
const DEFAULT_MIN_DPR = 1;

const DEFAULT_CAPTURE_KEYS = Object.freeze([
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "SPACE",
  "ENTER",
  "ESC",
  "W",
  "A",
  "S",
  "D",
]);

function getWindowObject() {
  if (typeof window !== "undefined") {
    return window;
  }

  if (globalThis?.window) {
    return globalThis.window;
  }

  return null;
}

function getDocumentObject() {
  if (typeof document !== "undefined") {
    return document;
  }

  if (globalThis?.document) {
    return globalThis.document;
  }

  return null;
}

export function resolveDevicePixelRatio({ min = DEFAULT_MIN_DPR, max = DEFAULT_MAX_DPR } = {}) {
  const browserWindow = getWindowObject();
  const ratio = Number(browserWindow?.devicePixelRatio ?? 1);

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return min;
  }

  return Math.min(max, Math.max(min, ratio));
}

export function applyKeyboardCapture(keyboard, keyNames = DEFAULT_CAPTURE_KEYS) {
  if (!keyboard || typeof keyboard.addCapture !== "function") {
    return;
  }

  keyboard.addCapture(keyNames);
}

export function createFocusVisibilityResetHook(onReset) {
  const browserWindow = getWindowObject();
  const browserDocument = getDocumentObject();
  if (typeof onReset !== "function") {
    return () => {};
  }

  const handleWindowBlur = () => {
    onReset("window-blur");
  };

  const handlePageHide = () => {
    onReset("page-hide");
  };

  const handleVisibilityChange = () => {
    if (browserDocument?.hidden) {
      onReset("document-hidden");
    }
  };

  browserWindow?.addEventListener?.("blur", handleWindowBlur, { passive: true });
  browserWindow?.addEventListener?.("pagehide", handlePageHide, { passive: true });
  browserDocument?.addEventListener?.("visibilitychange", handleVisibilityChange, { passive: true });

  return () => {
    browserWindow?.removeEventListener?.("blur", handleWindowBlur);
    browserWindow?.removeEventListener?.("pagehide", handlePageHide);
    browserDocument?.removeEventListener?.("visibilitychange", handleVisibilityChange);
  };
}

export function getPointerWorldPosition(scene, pointer) {
  if (!pointer || !scene) {
    return null;
  }

  const worldX = Number(pointer.worldX);
  const worldY = Number(pointer.worldY);

  if (Number.isFinite(worldX) && Number.isFinite(worldY)) {
    return { x: worldX, y: worldY };
  }

  const screenX = Number(pointer.x);
  const screenY = Number(pointer.y);
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    return null;
  }

  const camera = scene.cameras?.main;
  if (!camera || typeof camera.getWorldPoint !== "function") {
    return null;
  }

  const worldPoint = camera.getWorldPoint(screenX, screenY);
  if (!worldPoint) {
    return null;
  }

  return {
    x: Number(worldPoint.x),
    y: Number(worldPoint.y),
  };
}

export function normalizePointerScreenPosition(pointer) {
  const x = Number(pointer?.x);
  const y = Number(pointer?.y);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

export function getPointerInputSource(pointer) {
  const pointerType = pointer?.pointerType;
  if (typeof pointerType === "string" && pointerType.trim()) {
    return pointerType === "touch" ? "touch" : "mouse";
  }

  if (pointer?.wasTouch === true) {
    return "touch";
  }

  const eventPointerType = pointer?.event?.pointerType;
  if (typeof eventPointerType === "string" && eventPointerType.trim()) {
    return eventPointerType === "touch" ? "touch" : "mouse";
  }

  return "mouse";
}

function configureCanvasStyle(canvas) {
  if (!canvas || !canvas.style) {
    return;
  }

  canvas.style.touchAction = "none";
  canvas.style.webkitTapHighlightColor = "transparent";
  canvas.style.userSelect = "none";
}

export function configureGameBrowserCompatibility(game) {
  if (!game) {
    return () => {};
  }

  const browserWindow = getWindowObject();
  const browserDocument = getDocumentObject();
  const cleanupCallbacks = [];

  const canvas = game.canvas;
  configureCanvasStyle(canvas);

  const resetInputState = () => {
    game.input?.keyboard?.resetKeys?.();
    game.scene?.scenes?.forEach((scene) => {
      scene.input?.keyboard?.resetKeys?.();
    });
  };

  cleanupCallbacks.push(createFocusVisibilityResetHook(resetInputState));

  const resumeAudioContext = () => {
    const context = game.sound?.context;
    if (!context || context.state !== "suspended") {
      return;
    }

    const result = context.resume();
    if (result?.catch) {
      result.catch(() => {});
    }
  };

  const unlockEvents = ["pointerdown", "touchstart", "mousedown", "keydown"];
  unlockEvents.forEach((eventName) => {
    const target = eventName === "keydown" ? browserDocument : canvas ?? browserWindow;
    if (!target?.addEventListener) {
      return;
    }

    const handler = () => {
      resumeAudioContext();
    };
    target.addEventListener(eventName, handler, { passive: true });
    cleanupCallbacks.push(() => {
      target.removeEventListener(eventName, handler);
    });
  });

  let resizeRafId = 0;
  const handleResize = () => {
    if (!browserWindow || resizeRafId) {
      return;
    }

    resizeRafId = browserWindow.requestAnimationFrame(() => {
      resizeRafId = 0;
      game.scale?.refresh?.();
    });
  };

  browserWindow?.addEventListener?.("resize", handleResize, { passive: true });
  browserWindow?.addEventListener?.("orientationchange", handleResize, { passive: true });

  cleanupCallbacks.push(() => {
    browserWindow?.removeEventListener?.("resize", handleResize);
    browserWindow?.removeEventListener?.("orientationchange", handleResize);
    if (resizeRafId) {
      browserWindow?.cancelAnimationFrame?.(resizeRafId);
      resizeRafId = 0;
    }
  });

  const teardown = () => {
    cleanupCallbacks.splice(0).forEach((callback) => callback());
  };

  game.events?.once?.("destroy", teardown);
  return teardown;
}
