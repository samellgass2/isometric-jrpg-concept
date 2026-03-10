import assert from "node:assert/strict";
import { decideDroneAction } from "../src/battle/ai/droneDecisionController.js";

function createDrone(overrides = {}) {
  return {
    id: "enemy-zookeeper-scout-1",
    alive: true,
    tileX: 2,
    tileY: 2,
    movement: { tilesPerTurn: 4 },
    attack: { range: 2, canAttackOverObstacles: false },
    stats: { maxHp: 72, hp: 72 },
    ...overrides,
  };
}

function createPlayerUnit(id, overrides = {}) {
  return {
    id,
    alive: true,
    tileX: 0,
    tileY: 0,
    currentHp: 50,
    stats: { maxHp: 100, hp: 50 },
    ...overrides,
  };
}

function runTests() {
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 8;
  const noObstacles = () => false;

  const attackDecision = decideDroneAction({
    drone: createDrone(),
    playerUnits: [
      createPlayerUnit("player-near", { tileX: 4, tileY: 2, currentHp: 70, stats: { maxHp: 100 } }),
      createPlayerUnit("player-far", { tileX: 8, tileY: 2, currentHp: 10, stats: { maxHp: 100 } }),
    ],
    inBounds,
    isObstacleAt: noObstacles,
    isOccupied: () => false,
  });
  assert.equal(attackDecision.action, "attack", "Drone should attack when at least one player is in range.");
  assert.equal(
    attackDecision.targetId,
    "player-near",
    "Drone should prioritize closest vulnerable target before distant units."
  );

  const moveDecision = decideDroneAction({
    drone: createDrone({ tileX: 1, tileY: 1, attack: { range: 1, canAttackOverObstacles: false } }),
    playerUnits: [createPlayerUnit("player-target", { tileX: 8, tileY: 1, currentHp: 40, stats: { maxHp: 100 } })],
    inBounds,
    isObstacleAt: noObstacles,
    isOccupied: () => false,
  });
  assert.equal(moveDecision.action, "move", "Drone should move when no player target is in attack range.");
  assert.deepEqual(
    moveDecision.destination,
    { x: 5, y: 1 },
    "Drone movement should use full movement range toward nearest target."
  );

  const blockedDrone = createDrone({ tileX: 5, tileY: 5, movement: { tilesPerTurn: 1 } });
  const blockedSet = new Set(["6,5", "4,5", "5,6", "5,4"]);
  const waitDecision = decideDroneAction({
    drone: blockedDrone,
    playerUnits: [createPlayerUnit("player-target", { tileX: 9, tileY: 5 })],
    inBounds,
    isObstacleAt: (x, y) => blockedSet.has(`${x},${y}`),
    isOccupied: () => false,
  });
  assert.equal(waitDecision.action, "wait", "Drone should wait when all player targets are unreachable.");

  const noTargetDecision = decideDroneAction({
    drone: createDrone(),
    playerUnits: [],
    inBounds,
    isObstacleAt: noObstacles,
    isOccupied: () => false,
  });
  assert.equal(noTargetDecision.action, "wait", "Drone should wait when no valid targets remain.");

  console.log("Drone AI decision test passed.");
}

runTests();
