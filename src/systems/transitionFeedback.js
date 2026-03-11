function clampDuration(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }
  return Math.round(numeric);
}

function normalizeColor(color, fallback = [0, 0, 0]) {
  if (!Array.isArray(color) || color.length < 3) {
    return [...fallback];
  }

  return color.slice(0, 3).map((component, index) => {
    const fallbackComponent = fallback[index] ?? 0;
    const numeric = Number(component);
    if (!Number.isFinite(numeric)) {
      return fallbackComponent;
    }
    return Math.max(0, Math.min(255, Math.round(numeric)));
  });
}

function mergeSceneData(data, transitionIn) {
  const base = data && typeof data === "object" ? data : {};
  return {
    ...base,
    transitionIn,
  };
}

function readAudioManager(scene) {
  return scene?.game?.registry?.get?.("audioManager") ?? null;
}

export const TRANSITION_STINGER_KEYS = Object.freeze({
  battleStart: "sfx-transition-battle-start",
  battleReturn: "sfx-transition-battle-return",
});

export function applySceneEntryTransition(scene, data = {}, defaults = {}) {
  const request =
    data?.transitionIn && typeof data.transitionIn === "object" ? data.transitionIn : null;
  if (!request) {
    return;
  }

  const camera = scene?.cameras?.main;
  if (!camera) {
    return;
  }

  const duration = clampDuration(request.duration, clampDuration(defaults.duration, 200));
  if (duration <= 0) {
    return;
  }

  const color = normalizeColor(request.color, normalizeColor(defaults.color, [0, 0, 0]));
  camera.fadeIn(duration, color[0], color[1], color[2]);

  if (typeof request.stingerKey === "string" && request.stingerKey.trim()) {
    const audioManager = readAudioManager(scene);
    audioManager?.playSfx(request.stingerKey, {
      volume: request.stingerVolume,
    });
  }
}

export function transitionToScene(scene, options = {}) {
  const targetSceneKey = options.targetSceneKey;
  if (!targetSceneKey || typeof targetSceneKey !== "string") {
    return false;
  }

  const camera = scene?.cameras?.main;
  const baseData = options.data ?? {};
  const transitionIn = {
    duration: clampDuration(options.entryFadeInDuration, 200),
    color: normalizeColor(options.entryColor, [0, 0, 0]),
    stingerKey: options.entryStingerKey ?? null,
    stingerVolume: options.entryStingerVolume,
  };
  const nextData = mergeSceneData(baseData, transitionIn);

  const audioManager = readAudioManager(scene);
  if (options.stopMusic === true) {
    audioManager?.stopMusic();
  }

  if (typeof options.exitStingerKey === "string" && options.exitStingerKey.trim()) {
    audioManager?.playSfx(options.exitStingerKey, {
      volume: options.exitStingerVolume,
    });
  }

  const startNextScene = () => {
    scene.scene.start(targetSceneKey, nextData);
  };

  if (!camera) {
    const delay = clampDuration(options.delay, 0);
    scene.time.delayedCall(delay, startNextScene);
    return true;
  }

  const fadeOutDuration = clampDuration(options.fadeOutDuration, 190);
  const fadeOutColor = normalizeColor(options.fadeOutColor, [0, 0, 0]);
  const fallbackDelay = fadeOutDuration + clampDuration(options.delay, 15);
  let started = false;

  const guardedStart = () => {
    if (started) {
      return;
    }
    started = true;
    startNextScene();
  };

  camera.once("camerafadeoutcomplete", guardedStart);
  camera.fadeOut(fadeOutDuration, fadeOutColor[0], fadeOutColor[1], fadeOutColor[2]);
  scene.time.delayedCall(fallbackDelay, guardedStart);
  return true;
}
