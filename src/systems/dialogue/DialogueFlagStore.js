function normalizeFlagKey(flagKey) {
  if (typeof flagKey !== "string") {
    return "";
  }
  return flagKey.trim();
}

export default class DialogueFlagStore {
  constructor(initialFlags = {}) {
    this.flags = {};
    this.setFlags(initialFlags);
  }

  getFlag(flagKey) {
    const key = normalizeFlagKey(flagKey);
    if (!key) {
      return false;
    }
    return this.flags[key] === true;
  }

  setFlag(flagKey, value = true) {
    const key = normalizeFlagKey(flagKey);
    if (!key) {
      return false;
    }
    this.flags[key] = value === true;
    return this.flags[key];
  }

  setFlags(flags) {
    if (!flags || typeof flags !== "object") {
      return;
    }

    Object.entries(flags).forEach(([flagKey, value]) => {
      this.setFlag(flagKey, value);
    });
  }

  hasAll(flagKeys = []) {
    if (!Array.isArray(flagKeys) || flagKeys.length === 0) {
      return true;
    }

    return flagKeys.every((flagKey) => this.getFlag(flagKey));
  }

  hasAny(flagKeys = []) {
    if (!Array.isArray(flagKeys) || flagKeys.length === 0) {
      return false;
    }

    return flagKeys.some((flagKey) => this.getFlag(flagKey));
  }

  clearFlag(flagKey) {
    return this.setFlag(flagKey, false);
  }

  snapshot() {
    return { ...this.flags };
  }

  reset(nextFlags = {}) {
    this.flags = {};
    this.setFlags(nextFlags);
  }
}
