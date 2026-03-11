function normalizeId(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function createDialogueTree(tree = {}) {
  const treeId = normalizeId(tree.id) || "dialogue-tree";
  const startNodeId = normalizeId(tree.startNodeId);
  const nodes = tree.nodes && typeof tree.nodes === "object" ? { ...tree.nodes } : {};

  if (!startNodeId) {
    throw new Error(`Dialogue tree "${treeId}" is missing a startNodeId.`);
  }

  if (!nodes[startNodeId]) {
    throw new Error(`Dialogue tree "${treeId}" start node "${startNodeId}" does not exist.`);
  }

  return {
    id: treeId,
    npcId: normalizeId(tree.npcId) || null,
    speakers: tree.speakers && typeof tree.speakers === "object" ? { ...tree.speakers } : {},
    startNodeId,
    nodes,
  };
}

export function getDialogueNode(tree, nodeId) {
  const key = normalizeId(nodeId);
  if (!tree || !key) {
    return null;
  }
  return tree.nodes?.[key] ?? null;
}

export function resolveSpeakerMeta(tree, node) {
  if (!tree || !node) {
    return null;
  }

  const speakerId = normalizeId(node.speakerId);
  if (!speakerId) {
    return null;
  }

  const speaker = tree.speakers?.[speakerId];
  if (!speaker || typeof speaker !== "object") {
    return { id: speakerId, name: speakerId };
  }

  return {
    id: speakerId,
    ...speaker,
  };
}

export function isDialogueConditionMet(condition, context) {
  if (!condition) {
    return true;
  }

  if (typeof condition === "function") {
    return condition(context) === true;
  }

  if (typeof condition === "string") {
    return context.flagStore.getFlag(condition);
  }

  if (typeof condition !== "object") {
    return false;
  }

  const allFlags = Array.isArray(condition.allFlags) ? condition.allFlags : [];
  const anyFlags = Array.isArray(condition.anyFlags) ? condition.anyFlags : [];
  const noneFlags = Array.isArray(condition.noneFlags) ? condition.noneFlags : [];

  if (!context.flagStore.hasAll(allFlags)) {
    return false;
  }

  if (anyFlags.length > 0 && !context.flagStore.hasAny(anyFlags)) {
    return false;
  }

  if (noneFlags.some((flagKey) => context.flagStore.getFlag(flagKey))) {
    return false;
  }

  if (typeof condition.predicate === "function") {
    return condition.predicate(context) === true;
  }

  return true;
}

export function resolveConditionalTarget(nextTarget, context) {
  if (!nextTarget) {
    return null;
  }

  if (typeof nextTarget === "string") {
    return normalizeId(nextTarget) || null;
  }

  const candidateList = Array.isArray(nextTarget) ? nextTarget : [nextTarget];
  for (const candidate of candidateList) {
    if (!candidate) {
      continue;
    }

    if (typeof candidate === "string") {
      const direct = normalizeId(candidate);
      if (direct) {
        return direct;
      }
      continue;
    }

    if (typeof candidate !== "object") {
      continue;
    }

    if (!isDialogueConditionMet(candidate.condition, context)) {
      continue;
    }

    const targetNodeId = normalizeId(candidate.target ?? candidate.next);
    if (targetNodeId) {
      return targetNodeId;
    }
  }

  return null;
}

