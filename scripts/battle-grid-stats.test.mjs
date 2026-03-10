import assert from "node:assert/strict";
import {
  AI_BEHAVIOR_TAGS,
  cheetahUnit,
  elephantUnit,
  guardianDogUnit,
  zookeeperControllerDroneUnit,
  zookeeperDefenderDroneUnit,
  zookeeperScoutDroneUnit,
} from "../src/battle/units/animalUnits.js";
import { getEncounterDefinition } from "../src/battle/encounters.js";
import {
  canUnitTarget,
  chooseMovementDestinationTowardTarget,
  getReachableTiles,
  getTargetableTiles,
  getUnitMovementRange,
} from "../src/battle/grid.js";

function keyFor(x, y) {
  return `${x},${y}`;
}

function runTests() {
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 8;

  const cheetahTiles = getReachableTiles({
    start: { x: 4, y: 4 },
    moveRange: getUnitMovementRange(cheetahUnit),
    inBounds,
    isObstacleAt: () => false,
    isOccupied: () => false,
  });
  const dogTiles = getReachableTiles({
    start: { x: 4, y: 4 },
    moveRange: getUnitMovementRange(guardianDogUnit),
    inBounds,
    isObstacleAt: () => false,
    isOccupied: () => false,
  });
  const elephantTiles = getReachableTiles({
    start: { x: 4, y: 4 },
    moveRange: getUnitMovementRange(elephantUnit),
    inBounds,
    isObstacleAt: () => false,
    isOccupied: () => false,
  });

  assert.ok(
    cheetahTiles.length > dogTiles.length && dogTiles.length > elephantTiles.length,
    "Movement reachability should follow unit movement stats (cheetah > dog > elephant)."
  );

  const obstacleSet = new Set([keyFor(6, 2)]);
  const isObstacleAt = (x, y) => obstacleSet.has(keyFor(x, y));

  const baselineRanged = {
    id: "baseline-ranger",
    alive: true,
    tileX: 5,
    tileY: 2,
    attack: { range: 2, canAttackOverObstacles: false },
  };
  const elephant = {
    ...elephantUnit,
    alive: true,
    tileX: 5,
    tileY: 2,
  };
  const target = {
    id: "enemy-1",
    alive: true,
    tileX: 7,
    tileY: 2,
  };

  assert.equal(
    canUnitTarget(baselineRanged, target, { isObstacleAt }),
    false,
    "Non-elephant ranged unit should be blocked by obstacle on direct line."
  );
  assert.equal(
    canUnitTarget(elephant, target, { isObstacleAt }),
    true,
    "Elephant should target over obstacle tiles when in range."
  );

  const outOfRangeTarget = {
    id: "enemy-2",
    alive: true,
    tileX: 8,
    tileY: 2,
  };
  assert.equal(
    canUnitTarget(elephant, outOfRangeTarget, { isObstacleAt }),
    false,
    "Attack targeting must still respect attack range stat."
  );

  const elephantTargetTiles = getTargetableTiles({
    unit: elephant,
    width: 12,
    height: 8,
    isObstacleAt,
  });
  const blockedTileVisibleToElephant = elephantTargetTiles.some((tile) => tile.x === 7 && tile.y === 2);
  assert.equal(
    blockedTileVisibleToElephant,
    true,
    "Targetable tile list should include obstacle-screened tile for elephant."
  );

  const dog = {
    ...guardianDogUnit,
    alive: true,
    tileX: 1,
    tileY: 1,
    movement: { ...guardianDogUnit.movement, tilesPerTurn: 5 },
  };
  const reachableForDog = getReachableTiles({
    start: { x: dog.tileX, y: dog.tileY },
    moveRange: getUnitMovementRange(dog),
    inBounds,
    isObstacleAt: () => false,
    isOccupied: () => false,
  });
  const destination = chooseMovementDestinationTowardTarget({
    mover: dog,
    target: { tileX: 10, tileY: 1 },
    reachableTiles: reachableForDog,
    isOccupied: () => false,
  });

  assert.deepEqual(destination, { x: 6, y: 1 }, "Enemy movement choice should use full movement range, not fixed one-step movement.");

  assert.equal(
    zookeeperScoutDroneUnit.aiBehavior,
    AI_BEHAVIOR_TAGS.AGGRESSIVE,
    "Scout drone should use aggressive behavior tag."
  );
  assert.equal(
    zookeeperDefenderDroneUnit.aiBehavior,
    AI_BEHAVIOR_TAGS.DEFENSIVE,
    "Defender drone should use defensive behavior tag."
  );
  assert.equal(
    zookeeperControllerDroneUnit.aiBehavior,
    AI_BEHAVIOR_TAGS.SUPPORT,
    "Controller drone should use support behavior tag."
  );
  assert.ok(
    zookeeperDefenderDroneUnit.stats.maxHp > zookeeperControllerDroneUnit.stats.maxHp
      && zookeeperControllerDroneUnit.attack.range > zookeeperDefenderDroneUnit.attack.range
      && zookeeperScoutDroneUnit.movement.tilesPerTurn > zookeeperDefenderDroneUnit.movement.tilesPerTurn,
    "Drone variants should have clearly distinct stat profiles."
  );

  const canyonEncounter = getEncounterDefinition("level-2-canyon-gauntlet");
  const canyonEnemyArchetypes = canyonEncounter.enemyUnits.map((unit) => unit.archetype);
  assert.ok(
    canyonEnemyArchetypes.includes("zookeeper-drone"),
    "Encounter definitions should reference zookeeper drones so they can be spawned in battle scenes."
  );

  console.log("Battle grid stats test passed.");
}

runTests();
