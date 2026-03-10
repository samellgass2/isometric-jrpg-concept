function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function getUnitMovementRange(unit, fallback = 3) {
  const tilesPerTurn = toFiniteNumber(unit?.movement?.tilesPerTurn, fallback);
  return Math.max(0, Math.floor(tilesPerTurn));
}

export function getUnitAttackRange(unit, fallback = 1) {
  const range = toFiniteNumber(unit?.attack?.range, fallback);
  return Math.max(0, Math.floor(range));
}

export function canAttackOverObstacles(unit) {
  return Boolean(unit?.attack?.canAttackOverObstacles);
}

export function manhattanDistance(from, to) {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function keyForTile(x, y) {
  return `${x},${y}`;
}

export function hasBlockingObstacleBetween(from, to, isObstacleAt) {
  if (!from || !to || typeof isObstacleAt !== "function") {
    return false;
  }

  if (from.x === to.x) {
    const start = Math.min(from.y, to.y) + 1;
    const end = Math.max(from.y, to.y);
    for (let y = start; y < end; y += 1) {
      if (isObstacleAt(from.x, y)) {
        return true;
      }
    }
    return false;
  }

  if (from.y === to.y) {
    const start = Math.min(from.x, to.x) + 1;
    const end = Math.max(from.x, to.x);
    for (let x = start; x < end; x += 1) {
      if (isObstacleAt(x, from.y)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

export function canUnitTarget(attacker, defender, { isObstacleAt } = {}) {
  if (!attacker?.alive || !defender?.alive) {
    return false;
  }

  const attackRange = getUnitAttackRange(attacker);
  if (attackRange <= 0) {
    return false;
  }

  const attackerPoint = { x: attacker.tileX, y: attacker.tileY };
  const defenderPoint = { x: defender.tileX, y: defender.tileY };
  if (manhattanDistance(attackerPoint, defenderPoint) > attackRange) {
    return false;
  }

  if (canAttackOverObstacles(attacker)) {
    return true;
  }

  if (typeof isObstacleAt !== "function") {
    return true;
  }

  return !hasBlockingObstacleBetween(attackerPoint, defenderPoint, isObstacleAt);
}

export function getReachableTiles({
  start,
  moveRange,
  inBounds,
  isObstacleAt,
  isOccupied,
} = {}) {
  if (!start || typeof inBounds !== "function") {
    return [];
  }

  const maxRange = Math.max(0, Math.floor(toFiniteNumber(moveRange, 0)));
  if (maxRange <= 0) {
    return [];
  }

  const queue = [{ x: start.x, y: start.y, dist: 0 }];
  const visited = new Set([keyForTile(start.x, start.y)]);
  const tiles = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.dist >= maxRange) {
      continue;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    neighbors.forEach((neighbor) => {
      if (!inBounds(neighbor.x, neighbor.y)) {
        return;
      }
      const tileKey = keyForTile(neighbor.x, neighbor.y);
      if (visited.has(tileKey)) {
        return;
      }
      if (typeof isObstacleAt === "function" && isObstacleAt(neighbor.x, neighbor.y)) {
        return;
      }
      if (typeof isOccupied === "function" && isOccupied(neighbor.x, neighbor.y)) {
        return;
      }

      visited.add(tileKey);
      tiles.push({ x: neighbor.x, y: neighbor.y, dist: current.dist + 1 });
      queue.push({ x: neighbor.x, y: neighbor.y, dist: current.dist + 1 });
    });
  }

  return tiles;
}

export function getTargetableTiles({ unit, width, height, isObstacleAt } = {}) {
  if (!unit || !Number.isFinite(width) || !Number.isFinite(height)) {
    return [];
  }

  const attackRange = getUnitAttackRange(unit);
  if (attackRange <= 0) {
    return [];
  }

  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x === unit.tileX && y === unit.tileY) {
        continue;
      }

      const mockDefender = {
        alive: true,
        tileX: x,
        tileY: y,
      };

      if (canUnitTarget({ ...unit, alive: true }, mockDefender, { isObstacleAt })) {
        tiles.push({ x, y });
      }
    }
  }

  return tiles;
}

export function chooseMovementDestinationTowardTarget({
  mover,
  target,
  reachableTiles,
  isOccupied,
} = {}) {
  if (!mover || !target) {
    return null;
  }

  const candidateTiles = Array.isArray(reachableTiles) ? [...reachableTiles] : [];

  if (
    !candidateTiles.some(
      (tile) => tile.x === mover.tileX && tile.y === mover.tileY
    )
  ) {
    candidateTiles.push({ x: mover.tileX, y: mover.tileY, dist: 0 });
  }

  const freeTiles = candidateTiles.filter((tile) => {
    if (tile.x === mover.tileX && tile.y === mover.tileY) {
      return true;
    }
    return typeof isOccupied === "function" ? !isOccupied(tile.x, tile.y) : true;
  });

  freeTiles.sort((left, right) => {
    const leftDistance = manhattanDistance(left, { x: target.tileX, y: target.tileY });
    const rightDistance = manhattanDistance(right, { x: target.tileX, y: target.tileY });

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    const leftSteps = toFiniteNumber(left.dist, 0);
    const rightSteps = toFiniteNumber(right.dist, 0);
    if (leftSteps !== rightSteps) {
      return leftSteps - rightSteps;
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });

  const best = freeTiles[0] ?? null;
  if (!best || (best.x === mover.tileX && best.y === mover.tileY)) {
    return null;
  }

  return { x: best.x, y: best.y };
}
