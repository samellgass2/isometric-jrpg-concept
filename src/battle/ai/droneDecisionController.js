import {
  canUnitTarget,
  chooseMovementDestinationTowardTarget,
  getReachableTiles,
  getUnitMovementRange,
  manhattanDistance,
} from "../grid.js";

function resolveHp(unit) {
  if (Number.isFinite(unit?.currentHp)) {
    return unit.currentHp;
  }
  if (Number.isFinite(unit?.stats?.hp)) {
    return unit.stats.hp;
  }
  if (Number.isFinite(unit?.stats?.maxHp)) {
    return unit.stats.maxHp;
  }
  return 1;
}

function resolveHpRatio(unit) {
  const hp = Math.max(0, resolveHp(unit));
  const maxHp = Number.isFinite(unit?.stats?.maxHp) ? unit.stats.maxHp : hp;
  if (maxHp <= 0) {
    return 1;
  }
  return hp / maxHp;
}

function sortTargetsByPriority(drone, targets = []) {
  const dronePoint = { x: drone.tileX, y: drone.tileY };
  return [...targets].sort((left, right) => {
    const leftDistance = manhattanDistance(dronePoint, { x: left.tileX, y: left.tileY });
    const rightDistance = manhattanDistance(dronePoint, { x: right.tileX, y: right.tileY });
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    // At equal distance, pressure the more vulnerable target.
    const leftRatio = resolveHpRatio(left);
    const rightRatio = resolveHpRatio(right);
    if (leftRatio !== rightRatio) {
      return leftRatio - rightRatio;
    }

    const leftHp = resolveHp(left);
    const rightHp = resolveHp(right);
    if (leftHp !== rightHp) {
      return leftHp - rightHp;
    }

    const leftId = typeof left?.id === "string" ? left.id : "";
    const rightId = typeof right?.id === "string" ? right.id : "";
    return leftId.localeCompare(rightId);
  });
}

export function decideDroneAction({
  drone,
  playerUnits = [],
  inBounds,
  isObstacleAt,
  isOccupied,
} = {}) {
  if (!drone) {
    throw new Error("decideDroneAction requires a drone unit.");
  }

  const viableTargets = Array.isArray(playerUnits)
    ? playerUnits.filter((unit) => unit?.alive !== false)
    : [];
  if (viableTargets.length <= 0) {
    return {
      actorId: drone.id,
      action: "wait",
      reason: "No valid player targets.",
    };
  }

  const prioritizedTargets = sortTargetsByPriority(drone, viableTargets);
  const attackableTargets = prioritizedTargets.filter((target) =>
    canUnitTarget(drone, target, { isObstacleAt })
  );
  if (attackableTargets.length > 0) {
    return {
      actorId: drone.id,
      action: "attack",
      targetId: attackableTargets[0].id,
      reason: "Target in range.",
    };
  }

  const reachableTiles = getReachableTiles({
    start: { x: drone.tileX, y: drone.tileY },
    moveRange: getUnitMovementRange(drone),
    inBounds,
    isObstacleAt,
    isOccupied,
  });

  for (const target of prioritizedTargets) {
    const destination = chooseMovementDestinationTowardTarget({
      mover: drone,
      target,
      reachableTiles,
      isOccupied,
    });
    if (destination) {
      return {
        actorId: drone.id,
        action: "move",
        targetId: target.id,
        destination,
        reason: "No target in range; advancing toward closest vulnerable player.",
      };
    }
  }

  return {
    actorId: drone.id,
    action: "wait",
    reason: "No reachable path toward living player targets.",
  };
}

export default decideDroneAction;
