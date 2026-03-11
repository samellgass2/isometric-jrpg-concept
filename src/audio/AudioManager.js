function clamp01(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  if (numeric < 0) {
    return 0;
  }
  if (numeric > 1) {
    return 1;
  }
  return numeric;
}

class AudioManager {
  constructor(game, options = {}) {
    this.game = game ?? null;
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.volume = {
      music: clamp01(options.music, 1),
      sfx: clamp01(options.sfx, 1),
    };

    this.handleGameDestroy = () => {
      this.destroy();
    };

    if (this.game?.events?.once) {
      this.game.events.once("destroy", this.handleGameDestroy);
    }
  }

  isAvailable() {
    return Boolean(this.game?.sound && typeof this.game.sound.add === "function");
  }

  hasAudioKey(key) {
    const cacheExists = typeof this.game?.cache?.audio?.exists === "function";
    if (!cacheExists) {
      return true;
    }
    return this.game.cache.audio.exists(key);
  }

  setVolume(levels = {}) {
    if (levels && typeof levels === "object") {
      if (levels.music !== undefined) {
        this.volume.music = clamp01(levels.music, this.volume.music);
      }
      if (levels.sfx !== undefined) {
        this.volume.sfx = clamp01(levels.sfx, this.volume.sfx);
      }
    }

    if (this.currentMusic && typeof this.currentMusic.setVolume === "function") {
      try {
        this.currentMusic.setVolume(this.volume.music);
      } catch (error) {
        console.warn("[AudioManager] Failed to update music volume.", error);
      }
    }

    return { ...this.volume };
  }

  getVolume() {
    return { ...this.volume };
  }

  playSfx(key, options = {}) {
    if (!key || !this.isAvailable() || !this.hasAudioKey(key)) {
      return null;
    }

    let sound = null;
    try {
      const baseVolume = clamp01(options.volume, 1);
      sound = this.game.sound.add(key, {
        ...options,
        loop: false,
        volume: baseVolume * this.volume.sfx,
      });
      sound.once?.("complete", () => {
        sound?.destroy?.();
      });
      sound.play();
      return sound;
    } catch (error) {
      sound?.destroy?.();
      console.warn(`[AudioManager] Unable to play SFX '${key}'.`, error);
      return null;
    }
  }

  playMusic(key, options = {}) {
    if (!key || !this.isAvailable() || !this.hasAudioKey(key)) {
      return null;
    }

    const loop = options.loop ?? true;
    const restartIfSame = options.restartIfSame ?? false;

    if (this.currentMusic && this.currentMusicKey === key && !restartIfSame) {
      if (!this.currentMusic.isPlaying) {
        try {
          this.currentMusic.play();
        } catch (error) {
          console.warn(`[AudioManager] Unable to resume music '${key}'.`, error);
        }
      }
      return this.currentMusic;
    }

    this.stopMusic();

    let sound = null;
    try {
      const baseVolume = clamp01(options.volume, 1);
      sound = this.game.sound.add(key, {
        ...options,
        loop,
        volume: baseVolume * this.volume.music,
      });
      sound.play();
      this.currentMusic = sound;
      this.currentMusicKey = key;
      sound.once?.("complete", () => {
        if (this.currentMusic === sound) {
          this.currentMusic = null;
          this.currentMusicKey = null;
        }
      });
      return sound;
    } catch (error) {
      sound?.destroy?.();
      this.currentMusic = null;
      this.currentMusicKey = null;
      console.warn(`[AudioManager] Unable to play music '${key}'.`, error);
      return null;
    }
  }

  stopMusic() {
    if (!this.currentMusic) {
      return;
    }

    try {
      this.currentMusic.stop?.();
      this.currentMusic.destroy?.();
    } catch (error) {
      console.warn("[AudioManager] Unable to stop active music track.", error);
    } finally {
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  destroy() {
    this.stopMusic();
    if (this.game?.events?.off) {
      this.game.events.off("destroy", this.handleGameDestroy);
    }
    this.game = null;
  }
}

export default AudioManager;
