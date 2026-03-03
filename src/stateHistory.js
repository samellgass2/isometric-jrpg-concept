/**
 * Game state history manager for rollback functionality.
 * Uses snapshot cloning to keep historical states immutable.
 */

const cloneState = (state) => {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
};

export const createStateHistory = (initialState, { maxSnapshots = 100 } = {}) => {
  if (!initialState) {
    throw new Error("Initial state is required to create history.");
  }
  if (!Number.isInteger(maxSnapshots) || maxSnapshots < 1) {
    throw new Error("maxSnapshots must be a positive integer.");
  }

  const snapshots = [cloneState(initialState)];
  let pointer = 0;

  const dropFutureSnapshots = () => {
    if (pointer < snapshots.length - 1) {
      snapshots.splice(pointer + 1);
    }
  };

  const enforceLimit = () => {
    if (snapshots.length <= maxSnapshots) {
      return;
    }
    const overflow = snapshots.length - maxSnapshots;
    snapshots.splice(0, overflow);
    pointer = Math.max(0, pointer - overflow);
  };

  const recordSnapshot = (state) => {
    dropFutureSnapshots();
    snapshots.push(cloneState(state));
    pointer = snapshots.length - 1;
    enforceLimit();
    return getCurrent();
  };

  const getCurrent = () => cloneState(snapshots[pointer]);

  const preview = (mutator) => {
    const nextState = getCurrent();
    if (typeof mutator === "function") {
      mutator(nextState);
    }
    return nextState;
  };

  const commit = (mutator) => {
    const nextState = getCurrent();
    if (typeof mutator === "function") {
      mutator(nextState);
    }
    return recordSnapshot(nextState);
  };

  const rollback = (steps = 1) => {
    if (!Number.isInteger(steps) || steps < 1) {
      throw new Error("Rollback steps must be a positive integer.");
    }
    pointer = Math.max(0, pointer - steps);
    return getCurrent();
  };

  const rollbackTo = (index) => {
    if (!Number.isInteger(index)) {
      throw new Error("Rollback index must be an integer.");
    }
    if (index < 0 || index >= snapshots.length) {
      throw new RangeError("Rollback index is out of range.");
    }
    pointer = index;
    return getCurrent();
  };

  const size = () => snapshots.length;
  const getPointer = () => pointer;

  return {
    commit,
    rollback,
    rollbackTo,
    getCurrent,
    preview,
    size,
    getPointer,
  };
};

export { cloneState };
