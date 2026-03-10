import assert from "node:assert/strict";
import { decideDroneAction } from "../src/battle/ai/droneDecisionController.js";
import { getEncounterDefinition } from "../src/battle/encounters.js";
import { canUnitTarget } from "../src/battle/grid.js";
import { resolveAttack } from "../src/battle/combatResolver.js";

function runTests() {
  const encounter = getEncounterDefinition("drone-test-battle");
  assert.ok(encounter, "Drone test encounter should be defined.");
  assert.equal(encounter.name, "Drone Test Battle", "Encounter should be clearly named.");

  const friendlies = encounter.friendlyUnits;
  const enemies = encounter.enemyUnits;
  assert.ok(friendlies.length >= 1, "Drone test battle should include at least one player unit.");
  assert.ok(enemies.length >= 2, "Drone test battle should include multiple drones.");

  const droneArchetypeIds = new Set(enemies.map((enemy) => enemy.id));
  assert.ok(droneArchetypeIds.has("drone-test-defender-1"), "Scenario should include a defender drone.");
  assert.ok(droneArchetypeIds.has("drone-test-scout-1"), "Scenario should include a scout drone.");
  assert.ok(droneArchetypeIds.has("drone-test-controller-1"), "Scenario should include a controller drone.");

  const protagonist = {
    id: "protagonist",
    name: "Protagonist",
    alive: true,
    tileX: 2,
    tileY: 4,
    currentHp: 120,
    attack: { range: 1, baseDamage: 22, canAttackOverObstacles: false },
    stats: { maxHp: 120, defense: 14 },
    abilities: [],
    archetype: "hero",
  };

  const scoutDrone = {
    ...encounter.enemyUnits.find((enemy) => enemy.id === "drone-test-scout-1"),
    alive: true,
    tileX: 9,
    tileY: 2,
    currentHp: 72,
    stats: { ...encounter.enemyUnits.find((enemy) => enemy.id === "drone-test-scout-1").stats, hp: 72 },
  };

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 8;
  const obstacleSet = new Set((encounter.obstacles ?? []).map(({ x, y }) => `${x},${y}`));
  const isObstacleAt = (x, y) => obstacleSet.has(`${x},${y}`);

  const openingDecision = decideDroneAction({
    drone: scoutDrone,
    playerUnits: [protagonist],
    inBounds,
    isObstacleAt,
    isOccupied: () => false,
  });
  assert.equal(openingDecision.action, "move", "Scout should advance when no player is in range.");

  let movedScout = {
    ...scoutDrone,
    tileX: openingDecision.destination.x,
    tileY: openingDecision.destination.y,
  };
  let followupDecision = null;
  for (let i = 0; i < 4; i += 1) {
    followupDecision = decideDroneAction({
      drone: movedScout,
      playerUnits: [protagonist],
      inBounds,
      isObstacleAt,
      isOccupied: () => false,
    });

    if (followupDecision.action === "attack") {
      break;
    }

    assert.equal(
      followupDecision.action,
      "move",
      "Before reaching range, scout should continue advancing rather than waiting."
    );
    movedScout = {
      ...movedScout,
      tileX: followupDecision.destination.x,
      tileY: followupDecision.destination.y,
    };
  }
  assert.equal(followupDecision.action, "attack", "Scout should attack after advancing into range.");
  assert.equal(
    canUnitTarget(movedScout, protagonist, { isObstacleAt }),
    true,
    "Follow-up attack decision should correspond to a legal attack target."
  );

  const combatResult = resolveAttack({
    attacker: movedScout,
    defender: protagonist,
    protagonist,
  });
  assert.ok(combatResult.damage > 0, "Drone attack should deal positive damage for visible HP changes.");

  console.log("Drone test battle scenario test passed.");
}

runTests();
